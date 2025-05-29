import { SystemPort } from '../core/SystemPort';
import { World } from '../core/World';

interface Position {
    x: number;
    y: number;
    z: number;
}

interface Velocity {
    x: number;
    y: number;
    z: number;
}

export class MovementSystem implements SystemPort {
    update(deltaTime: number, world: World): void {
        // Query all entities that have both position and velocity components
        const entities = world.query(['position', 'velocity']);

        for (const entity of entities) {
            const position = entity.getComponent<Position>('position');
            const velocity = entity.getComponent<Velocity>('velocity');

            if (position && velocity) {
                // Update position based on velocity and delta time
                position.x += velocity.x * deltaTime;
                position.y += velocity.y * deltaTime;
                position.z += velocity.z * deltaTime;

                // Update the component
                entity.addComponent('position', position);
            }
        }
    }
} 