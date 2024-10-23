const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const ROWS = 8;
const COLS = 14;
const CARD_WIDTH = 50;  // Increased from 50
const CARD_HEIGHT = 50; // Increased from 50

let board = [];
let score = 0;
let selectedCards = [];

const generateCharacterPaths = (count) => {
    return Array.from(
        { length: count },
        (_, i) => `characters/${i + 1}.svg`
    );
};

const characters = generateCharacterPaths(28);

const DIFFICULTY = {
    EASY: 8,    // Use 8 pairs
    MEDIUM: 16,  // Use 16 pairs
    HARD: 28    // Use all pairs
};

const imageCache = new Map();

const INITIAL_TIME = 240;
const TIME_BONUS = 10;
let timeRemaining = INITIAL_TIME;
let timerInterval;

function generateRandomGradient() {
    // Function to generate a random color with low opacity
    const randomColor = () => {
        const r = Math.floor(Math.random() * 1024);
        const g = Math.floor(Math.random() * 1024);
        const b = Math.floor(Math.random() * 1024);
        return `rgba(${r}, ${g}, ${b}, 0.1)`;
    };

    // Generate 6 random colors
    const colors = Array.from({ length: 2 }, randomColor);
    
    // Apply to body
    document.body.style.background = `linear-gradient(
        0deg,
        ${colors.join(',\n        ')}
    )`;
}

async function preloadImages() {
    const loadImage = (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    };

    for (const src of characters) {
        try {
            const img = await loadImage(src);
            imageCache.set(src, img);
        } catch (error) {
            console.error(`Failed to load image: ${src}`, error);
        }
    }
}

function setDifficulty(level) {
    const numUniqueChars = DIFFICULTY[level];
    const shuffledChars = [...characters];
    // Shuffle the characters array
    for (let i = shuffledChars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledChars[i], shuffledChars[j]] = [shuffledChars[j], shuffledChars[i]];
    }
    // Return only the number of unique characters we want for this difficulty
    return shuffledChars.slice(0, numUniqueChars);
}

function initializeBoard() {
    const totalCells = ROWS * COLS;
    let cardPairs = [];
    let currentIndex = 0;
    
    // Keep adding pairs until we fill the board
    while (cardPairs.length < totalCells) {
        const char = characters[currentIndex % characters.length];
        // Add pairs (2, 4, 6, or 8 times randomly)
        const pairCount = Math.floor(Math.random() * 4 + 1) * 2; // Random even number between 2 and 8
        
        // Check if adding these pairs would exceed board size
        if (cardPairs.length + pairCount > totalCells) {
            // Just add one pair if we're near the end
            cardPairs.push(char, char);
        } else {
            // Add multiple pairs
            for (let i = 0; i < pairCount; i++) {
                cardPairs.push(char);
            }
        }
        currentIndex++;
    }
    
    // Trim excess cards if any
    cardPairs = cardPairs.slice(0, totalCells);
    
    // Shuffle the pairs
    for (let i = cardPairs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }
    
    // Fill the board
    let pairIndex = 0;
    for (let i = 0; i < ROWS; i++) {
        board[i] = [];
        for (let j = 0; j < COLS; j++) {
            board[i][j] = cardPairs[pairIndex++];
        }
    }
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
            if (board[i][j]) {
                // Card background
                ctx.fillStyle = 'white';
                ctx.fillRect(j * CARD_WIDTH, i * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT);
                
                // Card border
                ctx.strokeStyle = '#2196F3';
                ctx.lineWidth = 2;
                ctx.strokeRect(j * CARD_WIDTH, i * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT);
                
                // Draw SVG image
                const img = imageCache.get(board[i][j]);
                if (img) {
                    // Calculate dimensions to maintain aspect ratio
                    const padding = 5;
                    const maxWidth = CARD_WIDTH - (padding * 2);
                    const maxHeight = CARD_HEIGHT - (padding * 2);
                    const scale = Math.min(
                        maxWidth / img.width,
                        maxHeight / img.height
                    );
                    const width = img.width * scale;
                    const height = img.height * scale;
                    const x = j * CARD_WIDTH + (CARD_WIDTH - width) / 2;
                    const y = i * CARD_HEIGHT + (CARD_HEIGHT - height) / 2;
                    
                    ctx.drawImage(img, x, y, width, height);
                }
            }
        }
    }
    
    // Highlight selected cards
    selectedCards.forEach(card => {
        ctx.strokeStyle = '#FFC107';
        ctx.lineWidth = 3;
        ctx.strokeRect(card.x * CARD_WIDTH, card.y * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT);
    });
}

function findPath(x1, y1, x2, y2) {
    // Check if cards are adjacent
    const isAdjacent = (
        (Math.abs(x1 - x2) === 1 && y1 === y2) || // Horizontally adjacent
        (Math.abs(y1 - y2) === 1 && x1 === x2)    // Vertically adjacent
    );
    if (isAdjacent) {
        return [{x: x1, y: y1}, {x: x2, y: y2}];
    }

    const queue = [{
        x: x1,
        y: y1,
        lastDir: -1,
        dirChanges: 0,
        path: []
    }];

    // Track visited cells to avoid cycles
    const visited = new Set();

    // Possible directions: up, right, down, left
    const directions = [
        {dx: 0, dy: -1},
        {dx: 1, dy: 0},
        {dx: 0, dy: 1},
        {dx: -1, dy: 0}
    ];

    while (queue.length > 0) {
        const {x, y, lastDir, dirChanges, path} = queue.shift();
        const currentPath = [...path, {x, y}];
        const key = `${x},${y},${lastDir},${dirChanges}`;

        if (visited.has(key)) continue;
        visited.add(key);

        // If we reached the target with valid number of direction changes
        if (x === x2 && y === y2 && dirChanges <= 2) {
            return currentPath;
        }

        // Try all directions
        for (let dirIdx = 0; dirIdx < directions.length; dirIdx++) {
            const {dx, dy} = directions[dirIdx];
            const newX = x + dx;
            const newY = y + dy;

            // Skip if out of bounds
            if (newX < -1 || newX > COLS || newY < -1 || newY > ROWS) continue;

            // Calculate new direction changes
            const newDirChanges = dirChanges + (lastDir !== -1 && lastDir !== dirIdx ? 1 : 0);
            if (newDirChanges > 2) continue;

            // Check if the new position is valid (either empty, target card, or outside board)
            const isOutside = newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS;
            const isEmpty = !isOutside && board[newY][newX] === null;
            const isTarget = newX === x2 && newY === y2;

            if (isOutside || isEmpty || isTarget) {
                queue.push({
                    x: newX,
                    y: newY,
                    lastDir: dirIdx,
                    dirChanges: newDirChanges,
                    path: currentPath
                });
            }
        }
    }

    return null;  // No valid path found
}

function drawPath(path) {
    console.log("Drawing path:", path);
    ctx.save();
    
    // Draw lines
    ctx.beginPath();
    ctx.moveTo(path[0].x * CARD_WIDTH + CARD_WIDTH / 2, path[0].y * CARD_HEIGHT + CARD_HEIGHT / 2);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x * CARD_WIDTH + CARD_WIDTH / 2, path[i].y * CARD_HEIGHT + CARD_HEIGHT / 2);
    }
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 5;
    ctx.stroke();
    
    // Draw circles at each point
    ctx.fillStyle = 'blue';
    for (let point of path) {
        ctx.beginPath();
        ctx.arc(point.x * CARD_WIDTH + CARD_WIDTH / 2, point.y * CARD_HEIGHT + CARD_HEIGHT / 2, 10, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    ctx.restore();
}

function handleClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / CARD_WIDTH);
    const y = Math.floor((event.clientY - rect.top) / CARD_HEIGHT);

    console.log(`Clicked position: x=${x}, y=${y}`);
    console.log(`Card value at position:`, board[y][x]);
    console.log(`Current selected cards:`, selectedCards);

    if (board[y][x]) {
        if (selectedCards.length === 1 && x === selectedCards[0].x && y === selectedCards[0].y) {
            console.log('Deselecting the same card');
            selectedCards = [];
        } else {
            if (selectedCards.length === 1) {
                console.log('Attempting to match with first selected card:', selectedCards[0]);
                const first = selectedCards[0];
                
                console.log('Checking if cards match:', {
                    firstCard: board[first.y][first.x],
                    secondCard: board[y][x]
                });

                if (board[first.y][first.x] === board[y][x]) {
                    console.log('Cards have matching values, checking for valid path...');
                    const path = findPath(first.x, first.y, x, y);
                    console.log('Path found:', path);

                    if (path) {
                        console.log('Valid path found! Adding second card');
                        selectedCards.push({x, y});
                        drawBoard();
                        drawPath(path);
                        
                        console.log('Setting timeout to remove matched cards');
                        setTimeout(() => {
                            board[first.y][first.x] = null;
                            board[y][x] = null;
                            score += 10;
                            // Cap the time bonus at INITIAL_TIME
                            timeRemaining = Math.min(INITIAL_TIME, timeRemaining + TIME_BONUS);
                            scoreElement.textContent = score;
                            selectedCards = [];
                            drawBoard();
                            console.log('Cards removed, score updated, time bonus added');
                            
                            if (checkGameComplete()) {
                                clearInterval(timerInterval);
                                setTimeout(() => {
                                    alert(`Congratulations! You've completed the game with a score of ${score}!`);
                                    if (confirm('Would you like to play again?')) {
                                        resetGame();
                                    }
                                }, 800);
                            }
                        }, 700);
                    } else {
                        console.log('No valid path found, resetting selection');
                        selectedCards = [];
                    }
                } else {
                    console.log('Cards do not match, resetting selection');
                    selectedCards = [];
                }
            } else {
                console.log('Selecting first card');
                selectedCards.push({x, y});
            }
        }
        drawBoard();
    } else {
        console.log('Clicked on empty position');
    }
}

canvas.addEventListener('click', handleClick);

// Add new function to update timer
function updateTimer() {
    const timerBar = document.getElementById('timer-bar');
    const percentage = (timeRemaining / INITIAL_TIME) * 100;
    timerBar.style.width = `${percentage}%`;
    
    if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        alert('Time\'s up! Game Over!');
        if (confirm('Would you like to play again?')) {
            resetGame();
        }
    }
    timeRemaining--;
}

// Add reset game function
function resetGame() {
    score = 0;
    scoreElement.textContent = score;
    timeRemaining = INITIAL_TIME;
    clearInterval(timerInterval);
    initGame();
}

async function initGame() {
    generateRandomGradient();
    await preloadImages();
    initializeBoard();
    drawBoard();
    
    // Reset and start timer
    timeRemaining = INITIAL_TIME;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

// Replace the direct calls at the bottom with:
initGame().catch(console.error);

function checkGameComplete() {
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
            if (board[i][j] !== null) {
                return false;
            }
        }
    }
    return true;
}
