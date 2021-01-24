declare class PlaceablesLayer extends CanvasLayer {
    readonly placeables: PlaceableObject[];
    objects: PIXI.Container | null;

    /**
     * Draw the PlaceablesLayer.
     * Draw each Sound within the scene as a child of the sounds container.
     */
    draw(): Promise<PlaceablesLayer>;

    /**
     * Draw a single placeable object
     */
    createObject(data: unknown): PlaceableObject;
}
