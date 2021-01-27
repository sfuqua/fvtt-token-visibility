declare class PlaceablesLayer extends CanvasLayer {
    readonly placeables: PlaceableObject[];
    objects: PIXI.Container | null;

    get controlled(): PlaceableObject[];

    /**
     * Draw the PlaceablesLayer.
     * Draw each Sound within the scene as a child of the sounds container.
     */
    draw(): Promise<PlaceablesLayer>;

    /**
     * Draw a single placeable object
     */
    createObject(data: unknown): PlaceableObject;

    /**
     * Tries to find an object on this layer.
     */
    get(id: string): PlaceableObject | undefined;
}
