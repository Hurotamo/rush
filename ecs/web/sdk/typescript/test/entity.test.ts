import { Entity } from '../src/core/Entity'; // Adjusted path
import { PublicKey } from '@solana/web3.js';

describe('Entity', () => {
    let entity: Entity;
    const mockPublicKey = new PublicKey('11111111111111111111111111111111');

    beforeEach(() => {
        entity = new Entity('testEntity', mockPublicKey);
    });

    test('should create an entity with an ID and PublicKey', () => {
        expect(entity.getId()).toBe('testEntity');
        expect(entity.getPublicKey()).toBe(mockPublicKey);
        expect(entity.getComponents().size).toBe(0);
    });

    test('should add a component', () => {
        entity.addComponent('position', { x: 10, y: 20 });
        expect(entity.hasComponent('position')).toBe(true);
        expect(entity.getComponent('position')).toEqual({ x: 10, y: 20 });
    });

    test('should get a component', () => {
        entity.addComponent('health', { current: 100 });
        const healthComponent = entity.getComponent('health');
        expect(healthComponent).toEqual({ current: 100 });
    });

    test('should return undefined for a non-existent component', () => {
        const nonExistent = entity.getComponent('nonExistent');
        expect(nonExistent).toBeUndefined();
    });

    test('should check if a component exists', () => {
        entity.addComponent('mana', { current: 50 });
        expect(entity.hasComponent('mana')).toBe(true);
        expect(entity.hasComponent('stamina')).toBe(false);
    });

    test('should remove a component', () => {
        entity.addComponent('item', { name: 'Sword' });
        expect(entity.hasComponent('item')).toBe(true);
        const removed = entity.removeComponent('item');
        expect(removed).toBe(true);
        expect(entity.hasComponent('item')).toBe(false);
    });

    test('should return false when trying to remove a non-existent component', () => {
        const removed = entity.removeComponent('nonExistent');
        expect(removed).toBe(false);
    });

    test('should get all components', () => {
        entity.addComponent('position', { x: 0, y: 0 });
        entity.addComponent('velocity', { dx: 1, dy: 0 });
        const components = entity.getComponents();
        expect(components.size).toBe(2);
        expect(components.get('position')).toEqual({ x: 0, y: 0 });
        expect(components.get('velocity')).toEqual({ dx: 1, dy: 0 });
    });

    test('getComponents should return a copy, not a reference', () => {
        entity.addComponent('test', { value: 1 });
        const componentsMap = entity.getComponents();
        componentsMap.set('test', { value: 2 }); // Modify the returned map
        expect(entity.getComponent('test')).toEqual({ value: 1 }); // Original should be unchanged
    });
}); 