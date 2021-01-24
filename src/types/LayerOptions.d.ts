/**
 * Options for CanvasLayers.
 */
declare interface CanvasLayerOptions {
    zIndex: number;
}

/**
 * Options for PlaceableLayers.
 */
declare interface PlaceableLayerOptions extends CanvasLayerOptions {
    /**
     * Does this layer support a mouse-drag workflow to create new objects?
     */
    canDragCreate: boolean;

    /**
     *  Can objects be deleted from this layer?
     */
    canDelete: boolean;

    /**
     * Can placeable objects in this layer be controlled?
     */
    controllableObjects: boolean;

    /**
     * Can placeable objects in this layer be rotated?
     */
    rotatableObjects: boolean;

    /**
     * Do objects in this layer snap to the grid
     */
    snapToGrid: boolean;

    /**
     * At what numeric grid precision do objects snap?
     */
    gridPrecision: number;

    /**
     * The class used to represent an object on this layer.
     */
    objectClass: PlaceableObject | null;

    /**
     * Does this layer use a quadtree to track object positions?
     */
    quadtree: boolean;

    /**
     * The FormApplication class used to configure objects on this layer.
     */
    sheetClass: FormApplication | null;
}
