/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "triangles2.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space
var LookAt = new vec4.fromValues(0.5, 0.5, 0.5);
var Up = new vec4.fromValues(0, 1, 0);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var altPosition; // flag indicating whether to alter vertex positions
var vertexPositionAttrib; // where to put position for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader
var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
var normalBuffer;
var vertexNormalAttrib;
var shaderProgram; // create the single shader program

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var normalArray = []; // 1D array of the normals of the triangles.
        var indexArray = []; // 1D array of vertex indices for WebGL
        // vertex offset is used to number vertices across multiple sets
        var vertexOffset = 0;
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            
            // set up the vertex coord array and the normals array.
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
                coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
                normalArray = normalArray.concat(inputTriangles[whichSet].normals[whichSetVert]);
            }
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++){
                var triIndex = inputTriangles[whichSet].triangles[whichSetTri];
                indexArray = indexArray.concat(triIndex.map(index => index + vertexOffset));
            }
            // update the vertex offset for the next triangle set
            vertexOffset += inputTriangles[whichSet].vertices.length;
        } // end for each triangle set 

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW);

        // send the normal buffer to webGL
        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);
        
        triBufferSize = indexArray.length;
        for (let i = 0; i < inputTriangles.length; i++) {
            inputTriangles[i].rotation = [0, 0, 0];
        }
        
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    var fShaderCode = `
        precision mediump float;

        varying vec3 fragPosition;
        varying vec3 fragNormal;

        uniform vec3 lightPosition;
        uniform vec3 eye;

        uniform vec3 ambient;
        uniform vec3 diffuse;
        uniform vec3 specular;
        uniform float n;

        void main(void) {
            vec3 N = normalize(fragNormal);
            vec3 L = normalize(lightPosition - fragPosition);
            vec3 V = normalize(eye - fragPosition);
            vec3 H = normalize(L + V);

            //ambient
            vec3 amb = ambient;
            
            //diffuse
            float diff1 = max(dot(N, L), 0.0);
            vec3 diff = diffuse * diff1;

            //specular
            float spec1 = pow(max(dot(N, H), 0.0), n);
            vec3 spec = specular * spec1;

            vec3 color = amb + diff + spec;

            gl_FragColor = vec4(min(color, 1.0), 1.0); 
        }
    `;

    var vShaderCode = `
    
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;

        uniform mat4 model;
        uniform mat4 view;
        uniform mat4 projection;
        uniform mat3 normal;

        varying vec3 fragPosition;
        varying vec3 fragNormal;

        uniform bool altPosition;

        void main (void){
            vec4 pos = vec4(vertexPosition, 1.0);
            if (altPosition){
                pos = vec4(vertexPosition + vec3(-1.0, -1.0, 0.0), 1.0);
            }
            //pos is the position of the vertex in model space. The model matrix transforms the vertex into world space (in order to do translation, rotation, scale).
            //worldPosition is like where in the world/space is this vertex.
            vec4 worldPosition = model * pos;
            fragPosition = worldPosition.xyz;
            //normal matrix is the 3x3 version of the model matrix. Transforms vertex's normal into the world space.
            fragNormal = normalize(normal * vertexNormal);
            //View transforms from world space and projection transforms from view space. So, this moves the vertex into view and projects it.
            gl_Position = projection * view * worldPosition;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            
            // no shader program link errors
            } else { 
                // activate shader program (frag and vert)
                gl.useProgram(shaderProgram); 

                // get pointer to vertex shader input
                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                
                // get pointer to altPosition flag
                altPositionUniform = gl.getUniformLocation(shaderProgram, "altPosition");

                // get pointer to vertex normal
                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);
               
                // set all the fields that are used in the shaders.
                gl.uniform3f(gl.getUniformLocation(shaderProgram, "lightPosition"), -0.5, 1.5, -0.5);
                gl.uniform3f(gl.getUniformLocation(shaderProgram, "eye"), 0.5, 0.5, -0.5);
                
                return shaderProgram;
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000); // switch flag value every 2 seconds
} // end setup shaders

var bgColor = 0;

// render the loaded model
function renderTriangles() {
    bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    gl.clearColor(bgColor, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    requestAnimationFrame(renderTriangles);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.uniform1i(altPositionUniform, altPosition); // feed

    // normal buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

    var model = mat4.create();
    var view = mat4.create();
    var projection = mat4.create();
    var normalMatrix = mat3.create();
    mat4.lookAt(view, Eye, LookAt, Up);
    //mat3.normalFromMat4(normalMatrix, model);
    mat4.perspective(
        projection, 1, gl.canvas.width / gl.canvas.height, 0.1, 10.0
    );


    //Get the ambient, diffuse, specular, and n from the input files for all of the triangles.
    var offset = 0;
    for (let whichSet = 0; whichSet < inputTriangles.length; whichSet++){
        var material = inputTriangles[whichSet].material;
        var indices = inputTriangles[whichSet].triangles.length * 3;

        model = mat4.create();
        if (whichSet === index && selected){
            const triangle = inputTriangles[whichSet];
            vertices = triangle.vertices;

            // Find the center of the triangle.
            const cx = (vertices[0][0] + vertices[1][0] + vertices[2][0]) / 3;
            const cy = (vertices[0][1] + vertices[1][1] + vertices[2][1]) / 3;
            const cz = (vertices[0][2] + vertices[1][2] + vertices[2][2]) / 3;
            const center = [cx, cy, cz];

            // Scale around its center
            mat4.translate(model, model, center); //Move triangle to origin.

            // Apply rotation to triangle
            mat4.rotateX(model, model, triangle.rotation[0]);
            mat4.rotateY(model, model, triangle.rotation[1]);
            mat4.rotateZ(model, model, triangle.rotation[2]);

            mat4.scale(model, model, [1.2, 1.2, 1.2]); //Scale triangle
            mat4.translate(model, model, [-center[0], -center[1], -center[2]]); // move back
        }
        
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "model"), false, model);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "view"), false, view);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "projection"), false, projection);
        gl.uniformMatrix3fv(gl.getUniformLocation(shaderProgram, "normal"), false, normalMatrix);
    
        //Sends a vec3 to the GPU shader. So it pretty much assigns the value from the triangles file into the field that is defined in the shader, so that the shader can use that field to generate the light and colors.
        gl.uniform3fv(gl.getUniformLocation(shaderProgram, "ambient"), new Float32Array(material.ambient));
        gl.uniform3fv(gl.getUniformLocation(shaderProgram, "diffuse"), new Float32Array(material.diffuse));
        gl.uniform3fv(gl.getUniformLocation(shaderProgram, "specular"), new Float32Array(material.specular));
        gl.uniform1f(gl.getUniformLocation(shaderProgram, "n"), material.n);
    
        // Use drawElements
        gl.drawElements(gl.TRIANGLES,indices,gl.UNSIGNED_SHORT, offset * 2); // render
        offset += indices;
    }
} // end render triangles

var index = 0;
var selected = true;
var vertices = null;
var model;
var rotation = []; // [x, y, z]


document.addEventListener('keydown', (event) => {
    const speed = 0.025; // how much to move per keypress

    switch (event.key) {
        case 'a': // move view left, scene right
            Eye[0] += speed;
            LookAt[0] += speed;
            break;
        case 'd': // move view right, scene left
            Eye[0] -= speed;
            LookAt[0] -= speed;
            break;
        case 'w': // move view forward, scene gets closer
            Eye[2] += speed;
            LookAt[2] += speed;
            break;
        case 's': // move view backward, scene gets further
            Eye[2] -= speed;
            LookAt[2] -= speed;
            break;
        case 'q': // move view up, scene goes down
            Eye[1] += speed;
            LookAt[1] += speed;
            break;
        case 'e': // move view down, scene goes up
            Eye[1] -= speed;
            LookAt[1] -= speed;
            break;
        case 'A': // rotate view left, scene rotates right
            Eye[0] += speed;
            Up[0] += speed;
            break;
        case 'D': // rotate view right, scene rotates left
            Eye[0] -= speed;
            Up[0] -= speed;
            break;
        case 'W': // rotate view forward, scene rotates down
            Eye[1] += speed;
            Up[1] += speed;
            break;
        case 'S': // rotate view backward, scene rotates up
            Eye[1] -= speed;
            Up[1] -= speed;
            break;
        case "ArrowRight":
            index = (index + 1) % inputTriangles.length;
            selected = true;
            break;
        case "ArrowLeft":
            index = (index - 1 + inputTriangles.length) % inputTriangles.length;
            selected = true;
            break;
        case " ":
            selected = false;
            break;
        case "k":
            vertices[0][0] -= speed;
            vertices[1][0] -= speed;
            vertices[2][0] -= speed;
            break;
        case ";":
            vertices[0][0] += speed;
            vertices[1][0] += speed;
            vertices[2][0] += speed;
            break;
        case "o":
            vertices[0][2] += speed;
            vertices[1][2] += speed;
            vertices[2][2] += speed;
            break;
        case "l":
            vertices[0][2] -= speed;
            vertices[1][2] -= speed;
            vertices[2][2] -= speed;
            break;  
        case "i":
            vertices[0][1] -= speed;
            vertices[1][1] -= speed;
            vertices[2][1] -= speed;
            break;  
        case "p":
            vertices[0][1] += speed;
            vertices[1][1] += speed;
            vertices[2][1] += speed;
            break;
        case "K":
            inputTriangles[index].rotation[1] -= speed;
            break;
        case ":":
            inputTriangles[index].rotation[1] += speed;
            break;
        case "O":
            inputTriangles[index].rotation[0] -= speed;
            break;
        case "L":
            inputTriangles[index].rotation[0] += speed;
            break;
        case "I":
            inputTriangles[index].rotation[2] += speed;
            break;
        case "P":
            inputTriangles[index].rotation[2] -= speed;
            break;
    }

    updateViewMatrix();
});

/** Updates the view matrix when buttons on keyboard are pressed. */
function updateViewMatrix() {
    const view = mat4.create();
    mat4.lookAt(view, Eye, Center, Up);

    // Send to shader
    gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "view"), false, view);
    gl.uniform3fv(gl.getUniformLocation(shaderProgram, "eye"), Eye);

    // Redraw the scene
    renderTriangles();
}


/* MAIN -- HERE is where execution begins after window load */

function main() {
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
  
} // end main
