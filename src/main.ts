/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { fromEvent, generate, interval, merge } from "rxjs";
import { map, filter, scan } from "rxjs/operators";


// import { Key, Event, State, Block, Action } from './types';
// import { RNG } from './util';
// import { Viewport, Move, Tick, Constants, reduceState, initialState, blockCreation, Block } from './state';
  

/** User input */

/**
 * A string literal type for each key used in game control
 */
type Key = "KeyS" | "KeyA" | "KeyD" | "KeyW" | "KeyR"; 

/**
 * A 2D grid of cells, where each cell can contain either a string or null. This
 * type is used to represent the game board.
 */
type Grid<T> = T[][];

/**
 * Represents the state of the current game board.
 */
type State = Readonly<{ 
    gameEnd: boolean;
    score: number;
    highscore: number;
    level: number;
    spawn: boolean;
    currentTetromino: Block;
    nextTetromino: Block;
    gameBoard: Grid<string | null>; // a 2d array visualisation of the game board
  }>;

/**
 * A substructure type representing a tetromino block and its properties.
 */
type Block = Readonly<{ 
  name: string,
  colour: string,
  x: number,
  y: number,
  rotation: number,
  // dictates what shape the tetromino block is (see const Tetromino)
  shapesArray: ReadonlyArray<ReadonlyArray<number>>; 
}>

/**
 * An interface representing an action that can be applied to the game state,
 * updating it. Children of Action are used to perform specific operations in 
 * response to user input.
 * 
 * NOTE: Concept of using the Action interface and apply() method was inspired
 * by Asteroids code bundle.
 */
interface Action {
  /**
   * Applies the action to the current game state and returns the updated state.
   * @param s The current game state.
   * @return updated game state
   */
    apply(s: State): State;
  }

/** Constants */

const seed = Math.random();

/**
 * An object representing a tetromino's possible shapes, and each shapes' possible
 * rotations. Follows the Super Rotation System (SRS).
 */
const Tetromino: Record<string, number[][][]> = {  
  O: [
      [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
    ],
  
  I: [
    [
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  
  LL: [
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ],
  
  LR: [
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0], 
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  ],
  
  S: [
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  
  Z: [
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  ],
  
  T: [
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  }
  
  /**
   * a constant which maps tetromino names to their respective colors.
   */
  export const COLOUR: { [key: string]: string }= {
    O: "yellow",
    I: "aqua",
    LL: "blue",
    LR: "orange",
    S: "green",
    Z: "red",
    T: "purple",
  };

/**
 * Dictates the dimensions of the canvas and preview canvas.
 */
const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  TICK_RATE_MS: 500,
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
} as const;

/**
 * Defines dimensions of each individual cube in the game board grid.
 */
const Cube = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

// Applies an action on a given state. Returns the updated state.
const reduceState = (s: State, action: Action) => action.apply(s); 

/** Util */

/**
 * A random number generator providing two pure functions 'hash' and 'scale' and
 * 'generateRandomValue'. 
 * 
 * NOTE: This RNG class was based off the Week 4 Applied code bundle and modified 
 * to suit this assignment.
 */
abstract class RNG { 
  // LCG using GCC's constants
  private static m = 0x80000000; // 2**31
  private static a = 1103515245;
  private static c = 12345;

  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @param seed
   * @returns a hash of the seed
   */
  public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

  /**
   * Takes hash value and scales it to the range 
   */
  public static scale = (hash: number, max: number) => 
  Math.floor(((max * hash) / (RNG.m)));

  public static generateRandomValue = (seed: number, 
    max: number) => RNG.scale(RNG.hash(seed), max)
}

/**
 * Retrieves the coordinates of cubes within a tetromino shape on the canvas.
 *
 * @param coords the initial coordinates of the tetromino.
 * @param shapesArray the array representing the tetromino's shape.
 * @returns an array of x, y coordinate pairs for non-null cubes.
 */
const getCoordinates = (
  coords: number[],
  shapesArray: ReadonlyArray<ReadonlyArray<number>>): number[][] => {
  // map the shape array to create an array of coordinate pairs for cubes.
  const coordinates = shapesArray
    .map((row, rowIndex) => {
      return row.map((value, colIndex) => {
        // checks if the value is 1 in the shape array and calculates its coordinates.
        return value === 1 ? [coords[0] + colIndex, coords[1] + rowIndex] : null;
      });
    })
    .flat() // flattens the nested arrays to get an array of pairs.
    .filter(coordinate => coordinate !== null); // removes all null values

  return <number[][]>coordinates;
}

/**
 * Takes properties required to spawn a block. 
 * 
 * @param array an array representing the shape of a tetromino (see Tetromino).
 * @param colour the colour of a specific tetromino
 * @returns a block object representing a tetromino
 */
function spawnBlock(array: Array<Array<number>>, colour: string, name: string): Block { 
  return {
    name: name,
    colour: colour,
    x: 3, // middle of canvas
    y: -2, // block spawns above canvas height
    rotation: 0,
    shapesArray: array
}}

/**
 * Uses the spawnBlock function and RNG class to generate a random tetromino based
 * on a given seed.
 * @param seed 
 * @returns a random tetromino block object
 */
const generateRandomTetromino = (seed: number): Block  => {
    // retrieves tetrominos' shapes, names, and colors.
  const tetrominoShape = Object.values(Tetromino);
  const tetrominoName = Object.keys(Tetromino);
  const tetrominoColour = Object.keys(COLOUR);

  // generates a random index from [0,6]
  const randomIndex = RNG.generateRandomValue(seed, 7);

  // spawns random tetrominio with random shape and its respective colour and name.
  return spawnBlock(tetrominoShape[randomIndex][0], tetrominoColour[randomIndex], 
    tetrominoName[randomIndex]); 
}

/** State functions */

/**
 *  Properties of the initial state of the canvas.
 */
const initialState: State = {
  gameEnd: false,
  score: 0,
  highscore: 0,
  level: 0,
  spawn: true,
  currentTetromino: generateRandomTetromino(seed),
  nextTetromino: generateRandomTetromino(seed + 1), 
  // represents the gameboard as a 2d array, initially filled with null values
  gameBoard: Array.from( 
  { length: Constants.GRID_HEIGHT},
  () => Array(Constants.GRID_WIDTH).fill(null), 
)} as const;

// returns an SVG rectangle representing a single cube within a tetromino on the grid
const blockCreation = (x:number, y:number, colour: String, display: SVGGraphicsElement) => { 
    return createSvgElement(display.namespaceURI, "rect",{
      height: `${Cube.HEIGHT}`,
      width: `${Cube.WIDTH}`,
      x: `${x* Cube.WIDTH}`,
      y: `${y* Cube.HEIGHT}`,
      style: `fill: ${colour}`,
    });
}

/**
 * Adds the current tetromino's cubes to the state of the game board.
 * @param state The current game state
 * @returns An updated game state with the current tetromino's cubes added.
 */
const addCubesToState = (state: State): State => {
  // takes the color of the current tetromino
  const tetrominoColour = state.currentTetromino.colour;
  
  // gets a reference to the game board grid.
  const grid = state.gameBoard;

  // calculates the coordinates of the current tetromino's cubes.
  const blockCoords = [state.currentTetromino.x, state.currentTetromino.y];
  const coordinates = getCoordinates(blockCoords, state.currentTetromino.shapesArray);

  // update the game board by placing the current tetromino's color at its coordinates.
  const updatedGrid = grid.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (coordinates.some(([x, y]) => x === colIndex && y === rowIndex)) {
        return tetrominoColour;
      }
      return cell;
    })
  );
  console.log(updatedGrid)
  return { ...state, gameBoard: updatedGrid };
}

/**
 * Checks if the current tetromino collides with the floor of the game board.
 * @param state The current game state.
 * @returns True if collision with the floor is detected, false otherwise.
 */
const newCollisionWithFloor = (state: State): boolean => {
  // get the coordinates of the current tetromino's cubes.
  const blockCoords = [state.currentTetromino.x, state.currentTetromino.y];
  const coordinates = getCoordinates(blockCoords, state.currentTetromino.shapesArray);

  // check if any block's y-coordinate is greater than or equal to the game board's height.
  if (coordinates.some(([_, y]) => y >= state.gameBoard.length)) {
    return true; 
  }
  
  return false; 
}

/**
 * Checks if the current tetromino collides with other blocks on the game board.
 * @param s The current game state.
 * @returns True if collision with other blocks is detected, false otherwise.
 */
const blockCollision = (s: State): boolean => {
  // gets the coordinates of the current tetromino's cubes.
  const cubeCoords = getCoordinates(
    [s.currentTetromino.x, s.currentTetromino.y],
    s.currentTetromino.shapesArray
  ).filter(([_, y]) => y >= 0); // filters out blocks above the game board.

  // checks if any block's position overlaps with a non-null cell on the game board.
  const collision = cubeCoords.some(([y, x]) => s.gameBoard[x][y] !== null);
  return collision;
}

/**
 * checks if the current tetromino collides with the sides of the game board.
 * @param s The current game state.
 * @returns True if collision with the sides is detected, false otherwise.
 */
const sideCollision = (s: State): boolean => {
  // get the coordinates of the current tetromino's cubes.
  const cubeCoords = getCoordinates(
    [s.currentTetromino.x, s.currentTetromino.y],
    s.currentTetromino.shapesArray
  );

  // check if any active block's x-coordinate is outside the game board boundaries.
  if (cubeCoords.some(([x, y]) => x < 0 || x * Cube.WIDTH >= Viewport.CANVAS_WIDTH)) {
    return true;
  }

  return false; 
}
/**
 * Checks if the current tetromino has exceeded the ceiling of the game board,
 * thus ending the game.
 *
 * @param s The game state
 * @returns True if there is a collision with the top boundary, false otherwise
 */
const gameEnd = (s: State): boolean => {
  const cubeCoords = getCoordinates(
    [s.currentTetromino.x, s.currentTetromino.y],
    s.currentTetromino.shapesArray
    );
  // check if any block in the current tetromino has a y-coordinate less than 0
  const collision = cubeCoords.some(([_, y]) => y < 0);
  return collision;
};

/**
 * Finds the indices of full rows in the game board.
 *
 * @param gameBoard The game board represented as a 2D grid
 * @returns An array of row indices completely filled with cubes
 */
const fullRowIndices = (gameBoard: Grid<string | null>): number[] => {
  return gameBoard
    .map((row, index) => (row.every(value => value !== null) ? index : 1))
    .filter(index => index !== 1);
};

/**
 * Removes rows with specified indices from the game board.
 *
 * @param gameBoard The game board represented as a 2D grid
 * @param rowIndices An array of row indices to be removed
 * @returns A new game board with specified rows removed
 */
const removeLines = (gameBoard: Grid<string | null>, rowIndices: number[]): Grid<string | null> => {
  return gameBoard.filter((_, index) => !rowIndices.includes(index));
};

/**
 * Adds empty rows to the top of the game board so cubes don't float if line
 * below is cleared.
 *
 * @param rowCount The number of empty rows to add
 * @param width The width of the game board (number of columns)
 * @returns A new game board with empty rows added to the top
 */
const addEmptyRows = (rowCount: number, width: number): Grid<string | null> => {
  const emptyRow = Array(width).fill(null);
  return Array.from({ length: rowCount }, () => [...emptyRow]);
};

/**
 * Clears full rows from the game board and updates the game state.
 *
 * @param s The game state
 * @returns The updated game state after clearing full rows
 */
const clearRows = (s: State) => {
  const { gameBoard } = s;
  const fullLines = fullRowIndices(gameBoard);
  const gameBoardWithoutLines = removeLines(gameBoard, fullLines);
  const rowCountToAdd = Constants.GRID_HEIGHT - gameBoardWithoutLines.length;
  const newRows = addEmptyRows(rowCountToAdd, Constants.GRID_WIDTH);
  
  const updatedState = {
    ...s,
    gameBoard: newRows.concat(gameBoardWithoutLines), // add empty rows to the top
    score: s.score + fullLines.length, // updates the score based on cleared rows
  };
  
  return updatedState;
};

/**
 * A class representing an actions that advance the game state in one tick.
 */
class Tick implements Action {
  /**
   * Applies the tick action to the game state.
   *
   * @param s The current game state
   * @returns The updated game state after a tick
   */
  apply = (s: State): State => {

    const currentBlock = s.currentTetromino;

    // game has ended, no need for further movement
    if (s.gameEnd) {
      return s;
    }

    // updates the tetrimino's y position so it moves down in each tick
    const newTetromino = {
      ...currentBlock,
      y: currentBlock.y + 1, 
    };

    const newState = { ...s, currentTetromino: newTetromino};
    
    // updates high score if current score is greater
    if (s.score > s.highscore) {
      newState.highscore = s.score
    }

    if (newCollisionWithFloor(newState) || blockCollision(newState)) {
      if (gameEnd(s)) return {...s, gameEnd: true}

      // add cubes to the game state, then update the state with the next tetromino
      const addedCubes = addCubesToState(s);
      const updatedState = {
        ...addedCubes,
        nextTetromino: generateRandomTetromino(Date.now()),
        currentTetromino: s.nextTetromino,
        highscore: newState.highscore
      };

      // calls clearRows to clear full rows, update the game board and score
      return clearRows(updatedState);
    }

    return newState;
  };
}

/**
 * Represents an action to move the current tetromino by a specified position (x and y offsets).
 */
class Move implements Action {
  /**
   * Constructs a Move action with the given position offsets, as apply requires specific 
   * position offsets (x and y) to determine how the tetromino should be moved.
   *
   * @param pos The position offsets (x and y) to apply to the tetromino
   */
  constructor(public readonly pos: { x: number; y: number }) {}

  /**
   * Applies the move action to the game state.
   *
   * @param s The current game state
   * @returns The updated game state after applying the move
   */
  apply = (s: State): State => {
    // game has ended, no more movement should be possible 
    if (s.gameEnd) {
      return s;
    }

    const currentTetromino = s.currentTetromino;

    // create a new tetromino with its x position updated based on horizontal movement
    const newTetromino = {
      ...currentTetromino,
      x: currentTetromino.x + this.pos.x,
    };

    // new state contains this moved tetromino
    const newState = { ...s, currentTetromino: newTetromino };

    const blockCollide = blockCollision(newState);
    const sideCollide = sideCollision(newState);

    if (!blockCollide && !sideCollide) {
      // if no collision is detected, update the tetromino's position
      return newState;
    }

    // if a collision is detected, position will not be updated, preventing movement outside the canvas
    return s;
  };
}

/**
 * An action class for rotating the current tetromino in the game.
 */
class Rotate implements Action {
  apply = (s: State): State => {
    const name = s.currentTetromino.name;
    const rotationLength = Tetromino[name].length; // how many rotations

    // calculate the new rotation value by cycling through possible rotations
    const rotation = (s.currentTetromino.rotation + 1) % rotationLength;
    const newShapeArray = Tetromino[name][rotation];

    // create a new tetromino object with updated rotation and shape
    const rotatedTetromino = { ...s.currentTetromino, rotation, shapesArray: newShapeArray };

    // checks for collisions after rotation. if no collision detected, rotation is allowed.
    if (!blockCollision({ ...s, currentTetromino: rotatedTetromino }) 
    && !sideCollision({ ...s, currentTetromino: rotatedTetromino })) {
      return { ...s, currentTetromino: rotatedTetromino };
    }

    // if collision is detected, return the original state
    return s;
  };
}

/**
 * Action class for restarting the game.
 */
class Restart implements Action {
  apply = (s: State): State => {
    // reset the game state to the initial state
    const initialStateCopy = { ...initialState };
    initialStateCopy.highscore = s.highscore;
    initialStateCopy.currentTetromino = generateRandomTetromino(Date.now());
    initialStateCopy.nextTetromino = generateRandomTetromino(Date.now() + 1);

    // if the game end condition is met, recursively call the restart action
    if (initialStateCopy.gameEnd) {
      return this.apply(initialStateCopy);
    }

    return initialStateCopy;
  };
}

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const levelText = document.querySelector("#levelText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;
  
  /** User input */

  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));

    const left$ = fromKey("KeyA").pipe(map(() => new Move({ x: -1, y: 0 })));
    const right$ = fromKey("KeyD").pipe(map(() => new Move({ x: 1, y: 0 })));
    const down$ = fromKey("KeyS").pipe(map(() => new Tick()));   
    const up$ = fromKey("KeyW").pipe(map(() => new Rotate()));
    const restart$ = fromKey("KeyR").pipe(map(() => new Restart()));

  /** Observables */

  /** Determines the rate of time steps */
  const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(_ => new Tick()));

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    highScoreText.innerHTML = `${s.highscore}`;
    scoreText.innerHTML = `${s.score}`
    levelText.innerHTML = `${s.level}`
  
    // clear the main canvas (svg)
    Array.from(svg.childNodes).forEach(child => {
      if (child != gameover) {
        svg.removeChild(child);
      }
    });
  
    // clear the preview canvas
    Array.from(preview.childNodes).forEach(child => {
      if (child != gameover) {
        preview.removeChild(child);
      }
    });
  
    const current = s.currentTetromino;
    const next = s.nextTetromino;
    const colour = COLOUR[current.colour];
    const previewColour = COLOUR[next.colour];
    const x = current.x;
    const y = current.y;
  
    // renders the game board
    s.gameBoard.map((row, rowIndex) => {
      row.map((value, colIndex) => {
        if (typeof value === "string") {
          svg.appendChild(
            blockCreation(
              colIndex,
              rowIndex,
              COLOUR[value],
              svg
            )
          );
        }
      });
    });
  
    // renders the current tetromino in the main canvas
    current.shapesArray.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value === 1) {
          svg.appendChild(
            blockCreation(
              x + colIndex,
              y + rowIndex,
              colour,
              svg
            )
          );
        }
      });
    });
  
    // renders the next tetromino in the preview canvas
    next.shapesArray.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value === 1) {
          preview.appendChild(
            blockCreation(
              colIndex+2,
              rowIndex+1,
              previewColour,
              preview
            )
          );
        }
      });
    });
  };
  

  // combines game-related observables into a single observable source$
  const source$ = merge(tick$, left$, right$, down$, up$, restart$)
    // accumulate and reduce the game state over time
    .pipe(scan((s: State, a: Action) => reduceState(s,a), initialState))
    // subscribe to the source$ observable to handle game state updates
    .subscribe((s: State) => {
      // renders the updated game state
      render(s);
      if (s.gameEnd) {
        show(gameover);
      } else {
        hide(gameover);
      }
    });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
