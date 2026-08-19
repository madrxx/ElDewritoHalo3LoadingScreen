/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  06.23.2020
 *
 *  Loads the pre-scaled background-grid vertices from a packed Float32 resource.
 */

class BackgroundGrid {
    static getVertexCount() {
        return 319264;
    }

    static load(url) {
        if (BackgroundGrid.vertices) return Promise.resolve();
        if (BackgroundGrid.loadPromise) return BackgroundGrid.loadPromise;

        BackgroundGrid.loadPromise = fetch(url)
            .then(function (response) {
                if (!response.ok) throw new Error("Unable to load background grid: HTTP " + response.status);
                return response.arrayBuffer();
            })
            .then(function (buffer) {
                var expectedBytes = BackgroundGrid.getVertexCount() * 3 * Float32Array.BYTES_PER_ELEMENT;
                if (buffer.byteLength !== expectedBytes) {
                    throw new Error("Invalid background grid size: " + buffer.byteLength + " bytes");
                }
                BackgroundGrid.vertices = new Float32Array(buffer);
            });

        return BackgroundGrid.loadPromise;
    }

    static getVertices() {
        if (!BackgroundGrid.vertices) throw new Error("Background grid has not been loaded");
        return BackgroundGrid.vertices;
    }

    static release() {
        BackgroundGrid.vertices = null;
        BackgroundGrid.loadPromise = null;
    }
}

BackgroundGrid.vertices = null;
BackgroundGrid.loadPromise = null;
window.BackgroundGrid = BackgroundGrid;
