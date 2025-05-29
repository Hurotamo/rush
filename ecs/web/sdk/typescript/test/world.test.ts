/// <reference types="jest" />
import { World } from '../src/core/World';
import { Entity } from '../src/core/Entity';
import { SystemPort } from '../src/core/SystemPort';
import { PublicKey, Keypair } from '@solana/web3.js';

// Mock System
class MockSystem implements SystemPort {
    updated = false;
    lastDeltaTime = 0;
    entitiesProcessed: Entity[] = [];
    componentsRequired: string[] = [];

    constructor(componentsRequired: string[] = []){
        this.componentsRequired = componentsRequired;
    }

    update(deltaTime: number, world: World): void {
        this.updated = true;
        this.lastDeltaTime = deltaTime;
        this.entitiesProcessed = world.query(this.componentsRequired);
    }
}

describe('World', () => {
    let world: World;
    const mockEntityId1 = 'entity1';
    const mockEntityId2 = 'entity2';
    const mockPublicKey = PublicKey.default;
    const mockPublicKey2 = Keypair.generate().publicKey;

    beforeEach(() => {
        world = new World();
    });

    test('should create an entity', () => {
        const entity = world.createEntity('e1', mockPublicKey);
        expect(entity).toBeInstanceOf(Entity);
        expect(entity.getId()).toBe('e1');
        expect(world.getEntity('e1')).toBe(entity);
    });

    test('should remove an entity', () => {
        world.createEntity('e1', mockPublicKey);
        const removed = world.removeEntity('e1');
        expect(removed).toBe(true);
        expect(world.getEntity('e1')).toBeUndefined();
    });

    test('should return false when trying to remove a non-existent entity', () => {
        const removed = world.removeEntity('nonExistent');
        expect(removed).toBe(false);
    });

    test('should add and update a system', () => {
        const system = new MockSystem();
        world.addSystem(system);
        world.update(0.16);
        expect(system.updated).toBe(true);
        expect(system.lastDeltaTime).toBe(0.16);
    });

    test('should query entities by components', () => {
        const entity1 = world.createEntity('e1', mockPublicKey);
        entity1.addComponent('position', { x: 0, y: 0 });
        entity1.addComponent('renderable', true);

        const entity2 = world.createEntity('e2', mockPublicKey2);
        entity2.addComponent('position', { x: 10, y: 5 });

        const renderableEntities = world.query(['renderable']);
        expect(renderableEntities).toHaveLength(1);
        expect(renderableEntities[0]).toBe(entity1);

        const positionedEntities = world.query(['position']);
        expect(positionedEntities).toHaveLength(2);
        expect(positionedEntities).toContain(entity1);
        expect(positionedEntities).toContain(entity2);
    });

    test('query should return an empty array if no entities match', () => {
        world.createEntity('e1', mockPublicKey).addComponent('position', {});
        const results = world.query(['velocity']);
        expect(results).toEqual([]);
    });

    test('query should return all entities if no components are specified', () => {
        world.createEntity('e1', mockPublicKey);
        world.createEntity('e2', mockPublicKey2);
        const allEntities = world.query([]); 
        expect(allEntities).toHaveLength(2);
    });

    test('entity removal should update queries', () => {
        const entity1 = world.createEntity('e1', mockPublicKey);
        entity1.addComponent('position', { x: 0, y: 0 });
        world.query(['position']); // Initialize the query cache

        world.removeEntity('e1');
        const entities = world.query(['position']);
        expect(entities).toHaveLength(0);
    });

    test('entity creation should update queries', () => {
        world.query(['position']); // Initialize query cache
        const entity1 = world.createEntity('e1', mockPublicKey);
        entity1.addComponent('position', { x: 0, y: 0 });

        const entities = world.query(['position']);
        expect(entities).toHaveLength(1);
        expect(entities[0]).toBe(entity1);
    });

     test('system should receive correct entities from query', () => {
        const positionSystem = new MockSystem(['position']);
        world.addSystem(positionSystem);

        const entity1 = world.createEntity('e1', mockPublicKey);
        entity1.addComponent('position', { x: 0, y: 0 });

        const entity2 = world.createEntity('e2', mockPublicKey2);
        entity2.addComponent('velocity', { dx: 1, dy: 0 });
        
        world.update(0.1);

        expect(positionSystem.entitiesProcessed).toHaveLength(1);
        expect(positionSystem.entitiesProcessed[0]).toBe(entity1);
    });
}); 