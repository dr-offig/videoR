HTMLWidgets.widget({

  name: 'videoR',

  type: 'output',

  factory: function(el, width, height) {

    // TODO: define shared variables for this instance
    var copyVideo = false;
    var zoom = 1.0;
    var poi = { x: 0.0, y: 0.0 };
    var old_poi = poi;
    var panning = false;
    var panClickPoint = { x: 0.0, y: 0.0 };
    var subtractPrevFrame = false;
    var frameByFrame = false;

    resetZoomAndPan = function(dur) {
	    old_poi = poi;
	    target_poi = { x: 0.0, y: 0.0 };
	    //ptt = 0.0; pdt = 1 / dur;
		  zoom = 1.0;
    };

    function getMousePos(canvas, evt) {
        var rect = canvas.getBoundingClientRect();
		    return {
          x: ((evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
          y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
        };
    }

    function getMouseNDC(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
		  return {
				x: 2.0 * ((evt.clientX - rect.left) / (rect.right - rect.left) - 0.5),
        y: -2.0 * ((evt.clientY - rect.top) / (rect.bottom - rect.top) - 0.5)
      };
    }

    function initBuffers(gl) {

      // Create a buffer for the square's positions.

      const positionBuffer = gl.createBuffer();

      // Select the positionBuffer as the one to apply buffer
      // operations to from here out.

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

      // Now create an array of positions for the square.

      const positions = [
        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,
        -1.0,  1.0,
      ];

      // Now pass the list of positions into WebGL to build the
      // shape. We do this by creating a Float32Array from the
      // JavaScript array, then use it to fill the current buffer.

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);


    	// Creat the texture coordinates
    	const textureCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

      const textureCoordinates = [
        // Front
        0.0,  1.0,
        1.0,  1.0,
        1.0,  0.0,
        0.0,  0.0,
    	];

    	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

      // Build the element array buffer; this specifies the indices
      // into the vertex arrays for each face's vertices.
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      // This array defines each face as two triangles, using the
      // indices into the vertex array to specify each triangle's
      // position.
      const indices = [
        0,  1,  2,      0,  2,  3,
    	];

      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);


      return {
        position: positionBuffer,
        textureCoord: textureCoordBuffer,
        indices: indexBuffer,
      };
    }

    function initTexture(gl) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    width, height, border, srcFormat, srcType,
                    pixel);

      // Turn off mips and set  wrapping to clamp to edge so it
      // will work regardless of the dimensions of the video.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      return texture;
    }

    function updateTexture(gl, texture, video) {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      //gl.activeTexture(gl.TEXTURE0 + unit);
    	gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, video);
    }

    function zeroTexture(gl, texture)
    {
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const blackPixel = new Uint8Array([0, 0, 0, 0]);  // transparent black
    	gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    width, height, border, srcFormat, srcType,
                    blackPixel);
    }

    function drawScene(gl, programInfo, buffers, currFrameTexture, prevFrameTexture, deltaTime) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
      gl.clearDepth(1.0);                 // Clear everything
      gl.enable(gl.DEPTH_TEST);           // Enable depth testing
      gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

      // Clear the canvas before we start drawing on it.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const fieldOfView = 45 * Math.PI / 180;   // in radians
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      const zNear = 0.1;
      const zFar = 100.0;
      const projectionMatrix = mat4.create();

      // note: glmatrix.js always has the first argument
      // as the destination to receive the result.
      // mat4.perspective(projectionMatrix,
      //                  fieldOfView,
      //                  aspect,
      //                  zNear,
      //                  zFar);

      // Set the drawing position to the "identity" point, which is
      // the center of the scene.
      const modelViewMatrix = mat4.create();

      // Now move the drawing position a bit to where we want to
      // start drawing the square.
    	mat4.translate(modelViewMatrix,     // destination matrix
                     modelViewMatrix,     // matrix to translate
                     [poi.x, poi.y, -0.0]);

    	mat4.scale(modelViewMatrix,
    						 modelViewMatrix,
    							[zoom, zoom, 1.0]);

    	mat4.translate(modelViewMatrix,     // destination matrix
                     modelViewMatrix,     // matrix to translate
                     [-1 * poi.x, -1 * poi.y, -0.0]);  // amount to translate



      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexPosition);
      }


      // Tell WebGL how to pull out the texture coordinates from
      // the texture coordinate buffer into the textureCoord attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.textureCoord);
      }

      // Tell WebGL which indices to use to index the vertices
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);


      // Tell WebGL to use our program when drawing
      gl.useProgram(programInfo.program);

      // Set the shader uniforms

      gl.uniformMatrix4fv(
          programInfo.uniformLocations.projectionMatrix,
          false,
          projectionMatrix);
    //
    	gl.uniformMatrix4fv(
          programInfo.uniformLocations.modelViewMatrix,
          false,
          modelViewMatrix);


      // Specify the texture to map onto the canvas.

      // We will store the currFrameTexture in texture unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.currFrame, 0);

      // We will store the prevFrameTexture in texture unit 1
      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_2D, prevFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.prevFrame, 1);

      { // process the textures into the quad
        const type = gl.UNSIGNED_SHORT;
    		const offset = 0;
        const vertexCount = 6;
        gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
      }
    }
    function initShaderProgram(gl, vsSource, fsSource) {
      const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
      const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

      // Create the shader program
      const shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      // If creating the shader program failed, alert
      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
      }

      return shaderProgram;
    }

    function loadShader(gl, type, source) {
      const shader = gl.createShader(type);

      // Send the source to the shader object
      gl.shaderSource(shader, source);

      // Compile the shader program
      gl.compileShader(shader);

      // See if it compiled successfully
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    }

    return {

      renderValue: function(x) {

        // TODO: code to render the widget, e.g.
        //el.innerText = x.message;
        el.innerHTML = "<canvas id='glcanvas' width='1920px' height='1080px'></canvas>";
        const canvas = document.querySelector('#glcanvas');
        const gl = canvas.getContext('webgl');
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        // If we don't have a GL context, give up now
        if (!gl) { alert('Unable to initialize WebGL. Your browser or machine may not support it.'); return; }

      	// The video
      	const video = setupVideo(x.videoURL);
        video.style.display = 'none';
      	togglePlayback = function() {
      		if (video.paused) {
      			frameByFrame = false;
      			video.play();
      		} else {
      			video.pause();
      		}
      	};

      	showNextFrame = function() {
      		frameByFrame = true;
      		video.play();
      	};

      	nudge = function(amt) { video.currentTime += amt; };

      	function setupVideo(url) {
      	  const video = document.createElement('video');
          video.crossOrigin = "anonymous";
          var playing = false;
      	  var timeupdate = false;

      	  video.autoplay = true;
      	  video.muted = false;
      	  video.loop = true;

      	  // Waiting for these 2 events ensures
      	  // there is data in the video

      	  video.addEventListener('playing', function() {
      	     playing = true;
      	     checkReady();
      	  }, true);

      	  video.addEventListener('timeupdate', function() {
      	     timeupdate = true;
      	     checkReady();
      	  }, true);

      	  video.src = url;

      	  video.play();

      	  function checkReady() {
      	    if (playing && timeupdate) {
      	      copyVideo = true; }}

      	  return video;
      	}

      	//function setupSFX(url) {
      	//	const sfx = document.createElement('audio');
      	//	sfx.src = url;
      	//	sfx.autoplay = false;
        //
      	//	return sfx;
      	//};
      	//const sfx = setupSFX('camera_shutter.mp3');

      	// Event handling
      	mousedownHandler = function(evt) {
      		old_poi = getMouseNDC(canvas,evt);
      		panClickPoint = getMouseNDC(canvas,evt);
      		panning = true;
      		console.log("Starting pan from " + panClickPoint.x + ", " + panClickPoint.y);
      	};

      	mouseupHandler = function(evt) {
      		panning = false;
      	};

      	mousemoveHandler = function(evt) {
      		if (panning) {
      			evt.preventDefault();
      			currentMouse = getMouseNDC(canvas,evt);
      			poi.x = old_poi.x - (currentMouse.x - panClickPoint.x)/zoom;
      			poi.y = old_poi.y - (currentMouse.y - panClickPoint.y)/zoom;
      		}
      	};

      	keydownHandler = function(evt) {
          if (evt.key == "0") { resetZoomAndPan(); }
       		else if (evt.key == " ") { event.preventDefault(); togglePlayback(); }
      		else if (evt.key == "ArrowRight") { if (video.paused) showNextFrame(); else nudge(1.0); }
      		else if (evt.key == "ArrowLeft") { if (video.paused) nudge(-1/30); else nudge(-1.0); }
      		else if (evt.key == "F13") { console.log("Snapshot"); }
      		else if (evt.key == "d") { event.preventDefault(); toggleSubtractPrevFrame();  }
      		else { console.log(evt); }
      	};

      	wheelHandler = function(evt) {
      		evt.preventDefault();
      		console.log(evt);
      		poi = getMouseNDC(canvas,evt);
      		zoom *= (1 - Math.max(-0.5,Math.min(0.5, (evt.deltaY / 250))));
      		zoom = Math.max(zoom, 1.0);
      	};

      	document.addEventListener('keydown', keydownHandler);
      	canvas.addEventListener('wheel', wheelHandler);
      	canvas.addEventListener('mousedown', mousedownHandler);
      	canvas.addEventListener('mouseup', mouseupHandler);
      	canvas.addEventListener('mousemove', mousemoveHandler);

        // Vertex shader program
        const vsSource = `
          attribute vec4 aVertexPosition;
      		attribute vec2 aTextureCoord;

      		uniform mat4 uModelViewMatrix;
          uniform mat4 uProjectionMatrix;

      		varying highp vec2 vTextureCoord;

          void main(void) {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      			vTextureCoord = aTextureCoord;
          }
        `;

        // Fragment shader program
        const fsSource = `
          varying highp vec2 vTextureCoord;
      		uniform sampler2D uCurrFrame;
      		uniform sampler2D uPrevFrame;

      		void main() {
      			highp vec4 currTexelColor = texture2D(uCurrFrame, vTextureCoord);
      			highp vec4 prevTexelColor = texture2D(uPrevFrame, vTextureCoord);
            gl_FragColor = vec4(
      				abs(currTexelColor.r - prevTexelColor.r),
      				abs(currTexelColor.g - prevTexelColor.g),
      				abs(currTexelColor.b - prevTexelColor.b),
      				1.0);
          }
        `;

        // Initialize a shader program; this is where all the lighting
        // for the vertices and so forth is established.
        const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

        // Collect all the info needed to use the shader program.
        // Look up which attribute our shader program is using
        // for aVertexPosition and look up uniform locations.
        const programInfo = {
          program: shaderProgram,
          attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      			textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
          },
          uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      			currFrame: gl.getUniformLocation(shaderProgram, 'uCurrFrame'),
      			prevFrame: gl.getUniformLocation(shaderProgram, 'uPrevFrame'),
          },
        };

      	const buffers = initBuffers(gl);
        const currFrameTexture = initTexture(gl);
      	const prevFrameTexture = initTexture(gl);
      	zeroTexture(gl, prevFrameTexture);

      	toggleSubtractPrevFrame = function() {
      		if (subtractPrevFrame) {
      			zeroTexture(gl, prevFrameTexture);
      			subtractPrevFrame = false;
      		} else {
      			subtractPrevFrame = true;
      		}
      	}

      	// time of last animation frame
        var then = 0;

        // Main rendering loop
        function render(now) {
          now *= 0.001;  // convert to seconds
          const deltaTime = now - then;
          then = now;

          // Read in the next video frame
      		if (copyVideo && !video.seeking) { updateTexture(gl, currFrameTexture, video); }

      		// draw the scene
          drawScene(gl, programInfo, buffers, currFrameTexture, prevFrameTexture, deltaTime);

          // and update the previous frame texture
      		if (subtractPrevFrame && copyVideo && !video.seeking)
      			 { updateTexture(gl, prevFrameTexture, video); }

      		// if advancing frame by frame we need to re-pause the video
      		if (frameByFrame) { video.pause(); }

      		// Temporal recursion
          requestAnimationFrame(render);
        };

      	// Start the main rendering loop
      	requestAnimationFrame(render);
	    },

      resize: function(width, height) {

        // TODO: code to re-render the widget with a new size

      }

    };
  }
});
