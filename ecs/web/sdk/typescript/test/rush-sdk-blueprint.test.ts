import { RushSDK, SDKError } from '../src/RushSDK';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { IBluePrint, ComponentSchema } from '../src/types/types';
import * as fs from 'fs';

// Mock fs.readFileSync
jest.mock('fs');
const mockReadFileSync = fs.readFileSync as jest.Mock;

// Mock Entity and World classes for focused testing of processComponent
const mockAddComponent = jest.fn();
const mockGetEntity = jest.fn();
const mockCreateEntity = jest.fn();

jest.mock('../src/core/World', () => {
  return {
    World: jest.fn().mockImplementation(() => {
      return {
        getEntity: mockGetEntity,
        createEntity: mockCreateEntity, // Though not directly used by processComponent adding, good to have if entity needs creation
        // other methods as needed by RushSDK constructor or other tested methods
      };
    }),
  };
});

jest.mock('../src/core/Entity', () => {
  return {
    Entity: jest.fn().mockImplementation((id: string, publicKey: PublicKey) => {
      return {
        id,
        publicKey,
        addComponent: mockAddComponent,
        getComponents: jest.fn().mockReturnValue(new Map()),
        // other methods
      };
    }),
  };
});

describe('RushSDK - processComponent Blueprint Validation', () => {
    let sdk: RushSDK;
    let mockConnection: Connection;
    let mockProgramId: PublicKey;
    let entityId: string;
    let entityPublicKey: PublicKey;

    const sampleBlueprint: IBluePrint = {
        name: "TestBlueprint",
        description: "A test blueprint",
        componentSchemas: {
            Position: {
                type: "object",
                properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    z: { type: "number", optional: true },
                },
                required: ["x", "y"],
            },
            Health: {
                type: "object",
                properties: {
                    current: { type: "number", minimum: 0 },
                    max: { type: "number", minimum: 1 },
                },
                required: ["current", "max"],
            },
            PlayerTag: {
                type: "boolean",
            },
            Name: {
                type: "string",
                minLength: 1,
                maxLength: 50,
            },
            Inventory: {
                type: "array",
                items: { type: "string" }
            }
        },
        entities: { K: '', V: '', A: '' }, // Dummy, not used by new processComponent logic
        regions: { K: '', V: '', A: '' },
        instances: { K: '', V: '', A: '' },
    };

    beforeEach(() => {
        mockConnection = new Connection('http://localhost:8899');
        mockProgramId = PublicKey.default;
        entityId = 'testEntity1';
        entityPublicKey = Keypair.generate().publicKey;

        // Setup mock for getEntity to return a mock entity
        mockGetEntity.mockReturnValue({
            id: entityId,
            publicKey: entityPublicKey,
            addComponent: mockAddComponent,
            getComponents: jest.fn().mockReturnValue(new Map()),
        });
        mockAddComponent.mockClear();
        mockReadFileSync.mockClear();
    });

    const setupSDKWithBlueprint = (blueprint: IBluePrint | null) => {
        if (blueprint) {
            mockReadFileSync.mockReturnValue(JSON.stringify(blueprint));
        } else {
            // Simulate blueprint file not having componentSchemas or being empty
            mockReadFileSync.mockReturnValue(JSON.stringify({ name: "EmptyBlueprint", entities: {}, regions: {}, instances: {} }));
        }
        sdk = new RushSDK(mockConnection, mockProgramId, 'dummy/blueprint.json');
    };

    test('should add component if blueprint has no componentSchemas field', () => {
        const blueprintWithoutSchemas: IBluePrint = { ...sampleBlueprint, componentSchemas: undefined };
        setupSDKWithBlueprint(blueprintWithoutSchemas);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        sdk.processComponent(entityId, 'UnknownComponent', { data: 123 });
        expect(mockAddComponent).toHaveBeenCalledWith('UnknownComponent', { data: 123 });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Blueprint "TestBlueprint" is loaded but does not contain a \'componentSchemas\' definition. Skipping validation for component "UnknownComponent".'
        );
        consoleWarnSpy.mockRestore();
    });

    test('should throw error for undefined component type in blueprint', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'NonExistentComponent', {});
        }).toThrow(SDKError);
        expect(() => {
            sdk.processComponent(entityId, 'NonExistentComponent', {});
        }).toThrow('Component type "NonExistentComponent" is not defined in the blueprint\'s componentSchemas.');
    });

    // Position Component Tests
    test('Position: should validate and add valid component data', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        const validData = { x: 10, y: 20 };
        sdk.processComponent(entityId, 'Position', validData);
        expect(mockAddComponent).toHaveBeenCalledWith('Position', validData);
    });

    test('Position: should allow optional property z', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        const validDataWithZ = { x: 10, y: 20, z: 30 };
        sdk.processComponent(entityId, 'Position', validDataWithZ);
        expect(mockAddComponent).toHaveBeenCalledWith('Position', validDataWithZ);
    });

    test('Position: should throw error for missing required property y', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Position', { x: 10 });
        }).toThrow('Missing required property "y" for component "Position".');
    });

    test('Position: should throw error for incorrect data type for x', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Position', { x: 'wrong', y: 20 });
        }).toThrow('Data for component "Position.x" has incorrect type. Expected number, got string.');
    });

    test('Position: should warn for extra property', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        sdk.processComponent(entityId, 'Position', { x: 1, y: 2, extra: ' ভূমি' });
        expect(mockAddComponent).toHaveBeenCalledWith('Position', { x: 1, y: 2, extra: ' ভূমি' });
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Warning: Component "Position" has extra property "extra" not defined in blueprint schema.'
        );
        consoleWarnSpy.mockRestore();
    });

    // Health Component Tests
    test('Health: should validate and add valid health data', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        const validData = { current: 50, max: 100 };
        sdk.processComponent(entityId, 'Health', validData);
        expect(mockAddComponent).toHaveBeenCalledWith('Health', validData);
    });

    test('Health: should throw error for current health below minimum', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Health', { current: -10, max: 100 });
        }).toThrow('Component "Health.current" value -10 is less than minimum 0.');
    });

    test('Health: should throw error for max health below minimum', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Health', { current: 50, max: 0 });
        }).toThrow('Component "Health.max" value 0 is less than minimum 1.');
    });

    // PlayerTag Component Tests (boolean)
    test('PlayerTag: should validate and add valid boolean data', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        sdk.processComponent(entityId, 'PlayerTag', true);
        expect(mockAddComponent).toHaveBeenCalledWith('PlayerTag', true);
        sdk.processComponent(entityId, 'PlayerTag', false);
        expect(mockAddComponent).toHaveBeenCalledWith('PlayerTag', false);
    });

    test('PlayerTag: should throw error for non-boolean data', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'PlayerTag', 'not_boolean');
        }).toThrow('Data for component "PlayerTag" has incorrect type. Expected boolean, got string.');
    });

    // Name Component Tests (string with min/max length)
    test('Name: should validate and add valid string data', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        sdk.processComponent(entityId, 'Name', 'Player1');
        expect(mockAddComponent).toHaveBeenCalledWith('Name', 'Player1');
    });

    test('Name: should throw error for string too short', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Name', ''); // MinLength is 1
        }).toThrow('Component "Name" string length 0 is less than minimum 1.');
    });

    test('Name: should throw error for string too long', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        const longName = 'a'.repeat(51);
        expect(() => {
            sdk.processComponent(entityId, 'Name', longName);
        }).toThrow('Component "Name" string length 51 exceeds maximum 50.');
    });
    
    // Inventory Component Tests (array of strings)
    test('Inventory: should validate and add valid array of strings', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        const inventoryData = ['sword', 'shield'];
        sdk.processComponent(entityId, 'Inventory', inventoryData);
        expect(mockAddComponent).toHaveBeenCalledWith('Inventory', inventoryData);
    });

    test('Inventory: should accept empty array', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        sdk.processComponent(entityId, 'Inventory', []);
        expect(mockAddComponent).toHaveBeenCalledWith('Inventory', []);
    });

    test('Inventory: should throw error if not an array', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Inventory', 'not_an_array');
        }).toThrow('Data for component "Inventory" has incorrect type. Expected array, got string.');
    });

    test('Inventory: should throw error if array contains non-string items', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        expect(() => {
            sdk.processComponent(entityId, 'Inventory', ['sword', 123]);
        }).toThrow('Data for component "Inventory[1]" has incorrect type. Expected string, got number.');
    });

    test('should not add component if entity is not found (and not throw error by default)', () => {
        setupSDKWithBlueprint(sampleBlueprint);
        mockGetEntity.mockReturnValue(null); // Simulate entity not found
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        sdk.processComponent('nonExistentEntity', 'Position', { x: 1, y: 2 });
        
        expect(mockAddComponent).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Entity "nonExistentEntity" not found locally. Component "Position" was validated but not added.'
        );
        consoleWarnSpy.mockRestore();
    });

}); 