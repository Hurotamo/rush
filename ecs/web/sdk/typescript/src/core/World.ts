import { Entity } from './Entity';
import { SystemPort } from './SystemPort';
import { PublicKey } from '@solana/web3.js';

export class World {
    private entities: Map<string, Entity>;
    private systems: SystemPort[];
    private queries: Map<string, Entity[]>;

    constructor() {
        this.entities = new Map();
        this.systems = [];
        this.queries = new Map();
    }

    public createEntity(id: string, publicKey: PublicKey): Entity {
        const entity = new Entity(id, publicKey);
        this.entities.set(id, entity);
        this.updateQueries(entity);
        return entity;
    }

    public getEntity(id: string): Entity | undefined {
        return this.entities.get(id);
    }

    public removeEntity(id: string): boolean {
        const entity = this.entities.get(id);
        if (entity) {
            this.entities.delete(id);
            this.removeEntityFromQueries(entity);
            return true;
        }
        return false;
    }

    public addSystem(system: SystemPort): void {
        this.systems.push(system);
    }

    public update(deltaTime: number): void {
        for (const system of this.systems) {
            system.update(deltaTime, this);
        }
    }

    public query(components: string[]): Entity[] {
        const queryKey = components.sort().join(',');
        const matchingEntities = Array.from(this.entities.values()).filter(entity =>
            components.every(component => entity.hasComponent(component))
        );
        return matchingEntities;
    }

    private updateQueries(entity: Entity): void {
        for (const [queryKey, entities] of this.queries) {
            const components = queryKey.split(',');
            if (components.every(component => entity.hasComponent(component))) {
                entities.push(entity);
            }
        }
    }

    private removeEntityFromQueries(entity: Entity): void {
        for (const entities of this.queries.values()) {
            const index = entities.indexOf(entity);
            if (index !== -1) {
                entities.splice(index, 1);
            }
        }
    }
} 