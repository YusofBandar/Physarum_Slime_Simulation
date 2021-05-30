const agentsProcessVS = `
    attribute vec4 position;

    void main() {
        gl_Position = position;
    }
`;

const agentsProcessFS = `
    precision highp float;

    uniform float moveSpeed;
    uniform float turnSpeed;
    uniform float sensorAngleSpacing;

    uniform float sensorSize;
    uniform float sensorOffsetDist;

    uniform float time;
    uniform float deltaTime;

    uniform vec2 agents_resolution;
    uniform sampler2D agents_buffer;

    uniform sampler2D trail_map;
    uniform vec2 resolution;

    #define PI radians(180.0)

    float random (vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
    }

    float hash(float p) {
        vec2 p2 = fract(vec2(p * 5.3983, p * 5.4427));
        p2 += dot(p2.yx, p2.xy + vec2(21.5351, 14.3137));
        return fract(p2.x * p2.y * 95.4337);
    }

    float sense(vec2 position, float sensorAngle) {
        vec2 sensorDir = vec2(cos(sensorAngle), sin(sensorAngle));
        vec2 sensorCenter = position + sensorDir * sensorOffsetDist;
        vec2 sensorUV = sensorCenter / resolution;
        vec4 s = texture2D(trail_map, sensorUV, sensorSize);
        return s.r;
    }

    void main() { 
        float vertexId = floor(gl_FragCoord.y * agents_resolution.x + gl_FragCoord.x);
        vec2 texcoord = gl_FragCoord.xy / agents_resolution.xy;
        float randomNum = hash(vertexId / (agents_resolution.x * agents_resolution.y) + time);

        vec4 agent = texture2D(agents_buffer, texcoord);

        vec2 position = agent.xy;
        float angle = agent.z;

        float weightForward = sense(position, angle);
        float weightLeft = sense(position, angle + sensorAngleSpacing);
        float weightRight = sense(position, angle - sensorAngleSpacing);

        // continue in same direction
        if (weightForward > weightLeft && weightForward > weightRight) {
            angle += 0.0;
        } else if (weightForward < weightLeft && weightForward < weightRight) {
            angle += (randomNum - 0.5) * 2.0 * turnSpeed * deltaTime;
        } else if (weightRight > weightLeft) {
            angle -= randomNum * turnSpeed * deltaTime;
        } else if (weightLeft > weightRight) {
            angle += randomNum * turnSpeed * deltaTime;
        }

        vec2 direction = vec2(cos(angle), sin(angle));
        vec2 newPos = position + direction * moveSpeed * deltaTime;

        // clamp to boundries and pick new angle if hit boundries
        if (newPos.x < 0.0 || newPos.x >= resolution.x || 
            newPos.y < 0.0 || newPos.y >= resolution.y) {
            newPos.x = min(resolution.x - 0.01, max(0.0, newPos.x));
            newPos.y = min(resolution.y - 0.01, max(0.0, newPos.y));
            angle = randomNum * 2.0 * PI;
        }

        gl_FragColor = vec4(newPos, angle, 0);
    }
`;

const trailProcessVS = `
    attribute float position;

    uniform vec2 agents_resolution;
    uniform sampler2D agents_buffer;

    uniform float trailWeight;

    uniform vec2 resolution;

    uniform float deltaTime;

    varying vec4 v_colour;

    void main() {
        vec2 uv = (vec2(
            mod(position, agents_resolution.x),
            floor(position / agents_resolution.x)
            ) + 0.5) / agents_resolution;

        vec2 position1 = texture2D(agents_buffer, uv).xy;

        gl_Position = vec4(position1 / resolution * 2.0 - 1.0, 0, 1);
        gl_PointSize = 1.0;

        v_colour = vec4(vec3(trailWeight * deltaTime), 1);
    }
`;

const trailProcessFS = `
    precision highp float;
    varying vec4 v_colour;

    void main() { 
        gl_FragColor = v_colour;
    }
`;

const fadeProcessVS = `
    attribute vec4 position;

    void main() {
        gl_Position = position;
    }
`;

const fadeProcessFS = `
    precision highp float;

    uniform vec2 resolution;
    uniform sampler2D tex;

    uniform float evaporateSpeed;
    uniform float diffuseSpeed;

    uniform float deltaTime;

    void main() { 
        vec2 texcoord = gl_FragCoord.xy / resolution.xy;
        vec4 originalValue = texture2D(tex, texcoord);

        // Simulate diffuse with a simple 3x3 blur
        vec4 sum;
        for (int offsetY = -1; offsetY <= 1; ++offsetY) {
            for (int offsetX = -1; offsetX <= 1; ++offsetX) {
                vec2 sampleOff = vec2(offsetX, offsetY) / resolution;
                sum += texture2D(tex, texcoord + sampleOff);
            }
        }

        vec4 blurResult = sum / 9.0;

        vec4 diffusedValue = mix(originalValue, blurResult, diffuseSpeed * deltaTime);
        vec4 diffusedAndEvaporatedValue = max(vec4(0), diffusedValue - evaporateSpeed * deltaTime);

        gl_FragColor = vec4(diffusedAndEvaporatedValue.rgb, 1);
    }
`;

const drawVS = `
    attribute vec4 position;

    void main() {
        gl_Position = position;
    }
`;

const drawFS = `
    precision highp float;

    uniform vec2 resolution;
    uniform sampler2D tex;
    void main() { 
        vec2 texcoord = gl_FragCoord.xy / resolution.xy;
        vec4 colour = texture2D(tex, texcoord);
        gl_FragColor = colour;
    }
`;

/*
    window.moveSpeed = 85;
    window.turnSpeed = 76;
    window.trailWeight = 60;
    window.sensorOffsetDist = 40;
    window.sensorAngleSpacing = 1;
    window.sensorSize = 1;
    window.evaporateSpeed = 2.0;
    window.diffuseSpeed = 60;
*/

/*
    window.moveSpeed = 100;
    window.turnSpeed = 20;
    window.trailWeight = 60;
    window.sensorOffsetDist = 30;
    window.sensorAngleSpacing = 30;
    window.sensorSize = 70;
    window.evaporateSpeed = 20.0;
    window.diffuseSpeed = 80;
*/

window.moveSpeed = 85;
window.turnSpeed = 76;
window.trailWeight = 60;
window.sensorOffsetDist = 11;
window.sensorAngleSpacing = 1;
window.sensorSize = 5;
window.evaporateSpeed = 2.0;
window.diffuseSpeed = 40;

function main() {
    const count = 1000000;
    const width = 1024;
    const height = 1024;


    let resolution = [window.innerWidth, window.innerHeight];
    const canvas = document.querySelector("#canvas");
    canvas.width = resolution[0];
    canvas.height = resolution[1];


    const process = new WebGlProcess (width, height, canvas, {premultipliedAlpha:false, antialias: true});
    const draw = new WebGlProcess (width, height, canvas, {premultipliedAlpha:false, antialias: true});

    const gl = process.getGLContext();
    const check = process.getExtensions();

    window.play = true;

    if(check) {
        const processProgram = process.createProgram(agentsProcessVS, agentsProcessFS);
        const trailProgram = draw.createProgram(trailProcessVS, trailProcessFS);
        const fadeProgram = draw.createProgram(fadeProcessVS, fadeProcessFS);
        const drawProgram = draw.createProgram(drawVS, drawFS);

        const agents1 = process.createTexture(width, height, WebGLRenderingContext.FLOAT, createCircleInAgents(width * height, resolution, count));
        const agents2 = process.createTexture(width, height, WebGLRenderingContext.FLOAT, agentsEmptyData(width * height));
        const trailMap1 = process.createTexture(resolution[0], resolution[1], WebGLRenderingContext.FLOAT, agentsEmptyData(resolution[0] * resolution[1]));
        const trailMap2 = process.createTexture(resolution[0], resolution[1], WebGLRenderingContext.FLOAT, agentsEmptyData(resolution[0] * resolution[1]));

        let source = agents1;
        let destination = agents2;

        let trailMapSource = trailMap1;
        let trailMapDestination = trailMap2;

        const render = (time) => {
            if(window.play) {
                time *= 0.001;

                resolution = [window.innerWidth, window.innerHeight];

                drawProcessProgram(gl, process, processProgram, source, destination, trailMapSource, width, height, resolution, time);

                //process trailMap
                drawTrailProcessProgram(gl, process, trailProgram, destination, trailMapSource, count, width, height, resolution);

                // fade trailMap
                drawTrialMapProgram(gl, process, fadeProgram, trailMapSource, trailMapDestination, resolution);


                // draw agents
                drawAgentsProgram(gl, process, drawProgram, trailMapDestination, resolution);

                source = source === agents2 ? agents1 : agents2;
                destination = destination === agents2 ? agents1 : agents2;

                trailMapSource = trailMapSource === trailMap2 ? trailMap1 : trailMap2;
                trailMapDestination = trailMapDestination === trailMap2 ? trailMap1 : trailMap2;

            }

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);

    }else {
        console.error('Floating point textures are not supported.');
    }
} 

function agentsEmptyData(bufferSize) {
    const data = new Float32Array(bufferSize * 4);
    for (let i = 0; i < data.length; i=i+4) {

        data[i] = 0.0;
        data[i + 1] = 0.0;
        data[i + 2] = 0.0;
        data[i + 3] = 0.0;
    }

    return data;
}

function agentsPositionData(bufferSize, resolution) {
    const data = new Float32Array(bufferSize * 4);
    for (let i = 0; i < data.length; i=i+4) {
        data[i + 0] = resolution[0] / 2;
        data[i + 1] = resolution[1] / 2;
        data[i + 2] = getRandomArbitrary(0, 7);
        data[i + 3] = 0.0;
    }

    return data;
}


function createCircleInAgents(bufferSize, resolution) {
    const data = new Float32Array(bufferSize * 4);
    const radius = Math.min(resolution[0], resolution[1]) / 2;

    for (let i = 0; i < data.length; i=i+4) {
        const angle = getRandomArbitrary(0, Math.PI * 2);
        const r = Math.sqrt(getRandomArbitrary(0, 1)) * radius; //Math.sqrt(rand(1)) ∗ radius;

        data[i + 0] = resolution[0] / 2 + Math.cos(angle) * r;
        data[i + 1] = resolution[1] / 2 + Math.sin(angle) * r;
        data[i + 2] = angle + Math.PI;
        data[i + 3] = 0.0;
    }


    return data;
};

const drawProcessProgram = (gl, process, program, agentsSource, agentsDestination, trailMapSource, width, height, resolution, time) => {
    const deltaTime = 1 / 60;  // note: we don't really want this to be framerate independent.

    // process agents
    gl.useProgram(program);
    process.createStandardGeometry(program);

    const timeHandle = gl.getUniformLocation(program, 'time');

    const agentsResHandle = gl.getUniformLocation(program, 'agents_resolution');
    const agentsHandle = gl.getUniformLocation(program, 'agents_buffer');

    const moveSpeed = gl.getUniformLocation(program, 'moveSpeed');
    const turnSpeed = gl.getUniformLocation(program, 'turnSpeed');
    const sensorAngleSpacing = gl.getUniformLocation(program, 'sensorAngleSpacing');
    const sensorSize = gl.getUniformLocation(program, 'sensorSize');
    const sensorOffsetDist = gl.getUniformLocation(program, 'sensorOffsetDist');

    const resolutionHandle = gl.getUniformLocation(program, 'resolution');

    const trailMapHandle = gl.getUniformLocation(program, 'trail_map');

    const deltaTimeHandle = gl.getUniformLocation(program, 'deltaTime');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, agentsSource);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, trailMapSource);

    process.attachFrameBuffer(agentsDestination);

    gl.uniform1f(timeHandle, time);

    gl.uniform2fv(agentsResHandle, [width, height]);
    gl.uniform1i(agentsHandle, 0);

    gl.uniform1f(moveSpeed, window.moveSpeed);
    gl.uniform1f(turnSpeed, window.turnSpeed);
    gl.uniform1f(sensorAngleSpacing, window.sensorAngleSpacing);
    gl.uniform1f(sensorSize, window.sensorSize);
    gl.uniform1f(sensorOffsetDist, window.sensorOffsetDist);

    gl.uniform2fv(resolutionHandle, resolution);

    gl.uniform1i(trailMapHandle, 1);

    gl.uniform1f(deltaTimeHandle, deltaTime);

    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

const drawTrailProcessProgram = (gl, process, program, agentsDestination, trailMapSource, count, width, height, resolution) => {
    const deltaTime = 1 / 60;  // note: we don't really want this to be framerate independent.

    gl.useProgram(program);
    process.createBufferGeometry(program, width, height);

    const agentsResHandle = gl.getUniformLocation(program, 'agents_resolution');
    const agentsHandle = gl.getUniformLocation(program, 'agents_buffer');

    const trailWeight = gl.getUniformLocation(program, 'trailWeight');

    const resolutionHandle = gl.getUniformLocation(program, 'resolution');

    const deltaTimeHandle = gl.getUniformLocation(program, 'deltaTime');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, agentsDestination);

    process.attachFrameBuffer(trailMapSource);

    gl.uniform2fv(agentsResHandle, [width, height]);
    gl.uniform1i(agentsHandle, 0);

    gl.uniform1f(trailWeight, window.trailWeight);

    gl.uniform2fv(resolutionHandle, resolution);

    gl.uniform1f(deltaTimeHandle, deltaTime);

    gl.viewport(0, 0, resolution[0], resolution[1]);
    gl.drawArrays(gl.POINTS, 0, count);
}

const drawTrialMapProgram = (gl, process, program, trailMapSource, trailMapDestination, resolution) => {
    const deltaTime = 1 / 60;  // note: we don't really want this to be framerate independent.

    gl.useProgram(program);
    process.createStandardGeometry(program);

    const trailMapHandle = gl.getUniformLocation(program, 'tex');
    const trailMapResHandle = gl.getUniformLocation(program, 'resolution');

    const evaporateSpeed = gl.getUniformLocation(program, 'evaporateSpeed');
    const diffuseSpeed = gl.getUniformLocation(program, 'diffuseSpeed');

    const deltaTimeHandle = gl.getUniformLocation(program, 'deltaTime');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailMapSource);

    process.attachFrameBuffer(trailMapDestination);

    gl.uniform1i(trailMapHandle, 0);
    gl.uniform2fv(trailMapResHandle, resolution);

    gl.uniform1f(evaporateSpeed, window.evaporateSpeed);
    gl.uniform1f(diffuseSpeed, window.diffuseSpeed);

    gl.uniform1f(deltaTimeHandle, deltaTime);

    gl.viewport(0, 0, resolution[0], resolution[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

const drawAgentsProgram = (gl, process, program, trailMapDestination, resolution) => {
    gl.useProgram(program);
    process.createStandardGeometry(program);

    const textureHandle = gl.getUniformLocation(program, 'tex');
    const resolutionHandle = gl.getUniformLocation(program, 'resolution');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailMapDestination);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.uniform1i(textureHandle, 0);
    gl.uniform2fv(resolutionHandle, resolution);

    gl.viewport(0, 0, resolution[0], resolution[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

window.onload = main;


const WebGlProcess = class {
    defaultAttributes = { alpha: false, depth: false, antialias: false };

    constructor(width, height, canvasElement, attributes) {
        this.attributes = attributes ? attributes :  defaultAttributes;

        this.canvasWidth = width;
        this.canvasHeight = height;
        this.canvas = canvasElement ? canvasElement : this.makeGPCanvas(width, height);
        this.gl = this.getGLContext();
    }

    /**
     * Create a canvas for computational use.
     */
    makeGPCanvas = (canvasWidth, canvasHeight) => {
        const canvas = document.createElement('canvas');
        canvas.width  = canvasWidth;
        canvas.height = canvasHeight;

        return canvas;
    };

    getCanvas = () => {
        return this.canvas;
    };

    /**
     * Get a 3d context
     */
    getGLContext = () => {
        // Only fetch a gl context if we haven't already
        return this.gl ? this.gl : this.canvas.getContext('webgl', this.attributes);
    };

    /**
     * Enable necessary extensions
     */
    getExtensions = () => {
        const gl = this.gl;
        const extensions = [
            gl.getExtension('OES_texture_float'),
            gl.getExtension('OES_texture_float_linear'),
            gl.getExtension('WEBGL_color_buffer_float'),
            gl.getExtension('OES_vertex_array_object')
        ];

        const allExtensionsValid = extensions.every(extension => extension !== null);
        return allExtensionsValid;
    };

    /**
     *
     */
    createBufferGeometry = (program, width, height) => {
        const gl = this.gl


        if(!this.standardBufferVertices) {
            this.standardBufferVertices = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.standardBufferVertices);

            const standardGeometry = new Float32Array(width * height).map((v, i, a) => i);
            gl.bufferData(gl.ARRAY_BUFFER, standardGeometry, gl.STATIC_DRAW);
        }else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.standardBufferVertices);
        }


        const positionHandle = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionHandle);

        gl.vertexAttribPointer(positionHandle,
            1,                  // The three (x,y,z) elements in each value
            gl.FLOAT,           // The data type, so each position is three floating point numbers
            gl.FALSE,           // Are values normalized - unused for float
            0,                 // Stride, the spacing, in bytes, between beginnings of successive values
            0);                 // Offset 0, data starts at the beginning of the array
    };

    /**
     * Bind standard buffer for GPGPU calculations
     */
    createStandardGeometry = (program) => {
        const gl = this.gl


        if(!this.standardVertices) {
            this.standardVertices = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.standardVertices);

            // Sets of x,y,z(=0),s,t coordinates.
            const standardGeometry =  new Float32Array([-1.0,  1.0, 0.0, 0.0, 1.0,  // upper left
                -1.0, -1.0, 0.0, 0.0, 0.0,  // lower left
                1.0,  1.0, 0.0, 1.0, 1.0,  // upper right
                1.0, -1.0, 0.0, 1.0, 0.0]);// lower right
            gl.bufferData(gl.ARRAY_BUFFER, standardGeometry, gl.STATIC_DRAW);
        }else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.standardVertices);
        }

        const positionHandle = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionHandle);

        gl.vertexAttribPointer(positionHandle,
            3,                  // The three (x,y,z) elements in each value
            gl.FLOAT,           // The data type, so each position is three floating point numbers
            gl.FALSE,           // Are values normalized - unused for float
            20,                 // Stride, the spacing, in bytes, between beginnings of successive values
            0);                 // Offset 0, data starts at the beginning of the array
    };

    createTexture = (width, height, type, data) => {
        const gl = this.gl;

        const texture = gl.createTexture();
        // Bind the texture so the following methods effect this texture.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Pixel format and data for the texture
        gl.texImage2D(gl.TEXTURE_2D, // Target, matches bind above.
            0,             // Level of detail.
            gl.RGBA,       // Internal format.
            width,         // Width - normalized to s.
            height,        // Height - normalized to t.
            0,             // Always 0 in OpenGL ES.
            gl.RGBA,       // Format for each pixel.
            type,          // Data type for each chanel.
            data);         // Image data in the described format, or null.

        // Unbind the texture.
        gl.bindTexture(gl.TEXTURE_2D, null);

        return texture;
    }

    /**
     * Create and compile a vertex or fragment shader as given by the shader type.
     */
    compileShader = (shaderSource, shaderType) => {
        const gl = this.gl;

        const shader = gl.createShader(shaderType);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);

        let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            throw "Shader compile failed with:" + gl.getShaderInfoLog(shader);
        }

        return shader;
    };

    /**
     * Create and bind a framebuffer, then attach a texture.
     */
    attachFrameBuffer =  (texture) => {
        const gl = this.gl;
        const frameBuffer = gl.createFramebuffer();

        // Make it the target for framebuffer operations - including rendering.
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,       // The target is always a FRAMEBUFFER.
            gl.COLOR_ATTACHMENT0, // We are providing the color buffer.
            gl.TEXTURE_2D,        // This is a 2D image texture.
            texture,              // The texture.
            0);                   // 0, we aren't using MIPMAPs

        return frameBuffer;
    };


    /**
     * Create a program from the shader sources.
     */
    createProgram = (vertexShaderSource, fragmentShaderSource) => {
        const gl = this.gl;

        const program = gl.createProgram();

        const vertexShader = this.compileShader(vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        gl.linkProgram(program);

        return program;
    };

};

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

