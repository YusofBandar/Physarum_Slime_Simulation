function main() {
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

}
