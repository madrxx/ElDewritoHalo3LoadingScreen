
/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.26.2020
 *
 *  A simple utility class that encapsulates the logic of loading an
 *  image into the project.
 */


class ImageLoader {


    /*--- "Public" Load Image Method ---*/

    static loadImage(gl, textures, url, index, dimensionsCallback) {
        return new Promise(function(resolve) {
            let image = new Image();
            let texture = gl.createTexture();
            textures[index] = texture;

            image.crossOrigin = "";
            image.onload = function() {
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
                gl.activeTexture(gl.TEXTURE0 + index);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                if (typeof dimensionsCallback === "function") {
                    dimensionsCallback(image.naturalWidth || image.width, image.naturalHeight || image.height);
                }
                resolve(texture);
            };
            image.onerror = function() {
                // A missing optional texture must not disable the entire WebGL renderer.
                // Blocks receive an opaque white texel; logo and vignette receive transparency.
                let fallback = index === 0
                    ? new Uint8Array([255, 255, 255, 255])
                    : new Uint8Array([0, 0, 0, 0]);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
                gl.activeTexture(gl.TEXTURE0 + index);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    1,
                    1,
                    0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    fallback
                );
                if (typeof dimensionsCallback === "function") dimensionsCallback(1, 1);
                console.warn("Using fallback WebGL texture for " + url);
                resolve(texture);
            };
            image.src = url;
        });
    }
}