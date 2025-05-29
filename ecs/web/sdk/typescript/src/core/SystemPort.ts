import { World } from './World';

export interface SystemPort {
    update(deltaTime: number, world: World): void;
} 