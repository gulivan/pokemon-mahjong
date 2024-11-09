const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const ROWS = 8;
const COLS = 14;
const CARD_WIDTH = 50;  
const CARD_HEIGHT = 50;
const CHARACTER_COUNT = 26;
const INITIAL_TIME = 90;
const TIME_BONUS = 6;

let board = [];
let score = 0;
let selectedCards = [];

const generateCharacterPaths = (count) => {
    return Array.from(
        { length: count },
        (_, i) => `characters/img_${String(i + 1).padStart(2, '0')}.jpg`
    );
};

const characters = generateCharacterPaths(CHARACTER_COUNT);

const DIFFICULTY = {
    EASY: Math.floor(CHARACTER_COUNT*0.25),
    MEDIUM: Math.floor(CHARACTER_COUNT*0.5),
    MEDIUM_PLUS: Math.floor(CHARACTER_COUNT*0.8), 
    HARD: CHARACTER_COUNT 
};

const imageCache = new Map();


let timeRemaining = INITIAL_TIME;
let timerInterval;

// Get the device pixel ratio and canvas context
const PIXEL_RATIO = window.devicePixelRatio || 1;

// Set the canvas size to match the game board dimensions with pixel ratio
canvas.width = COLS * CARD_WIDTH * PIXEL_RATIO;   // e.g., 700 * 2 = 1400px on Retina
canvas.height = ROWS * CARD_HEIGHT * PIXEL_RATIO; // e.g., 400 * 2 = 800px on Retina

// Set display size (CSS pixels)
canvas.style.width = COLS * CARD_WIDTH + 'px';    // 700px
canvas.style.height = ROWS * CARD_HEIGHT + 'px';  // 400px

// Scale the context to handle the pixel ratio
ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

// Enable high-quality image rendering
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

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
            img.onload = () => {
                console.log(`Successfully loaded: ${src}`);
                resolve(img);
            };
            img.onerror = (e) => {
                console.error(`Failed to load image: ${src}`, e);
                reject(e);
            };
            img.src = src;
        });
    };


    for (const src of characters) {
        try {
            const img = await loadImage(src);
            imageCache.set(src, img);
            console.log(`Cached image: ${src}, size: ${img.width}x${img.height}`);
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
                
                // Draw image - simply draw it to fill the card
                const img = imageCache.get(board[i][j]);
                if (img) {
                    ctx.drawImage(img, 
                        j * CARD_WIDTH, 
                        i * CARD_HEIGHT, 
                        CARD_WIDTH, 
                        CARD_HEIGHT
                    );
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

async function findPath(x1, y1, x2, y2) {
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

    const visited = new Set();
    const directions = [
        {dx: 0, dy: -1},
        {dx: 1, dy: 0},
        {dx: 0, dy: 1},
        {dx: -1, dy: 0}
    ];

    // Function to visualize current exploration
    const visualizeExploration = (currentPos, visited) => {
        ctx.save();
        
        // Draw visited cells
        visited.forEach(key => {
            const [x, y] = key.split(',');
            ctx.fillStyle = 'rgba(255, 165, 0, 0.2)'; // Semi-transparent orange
            ctx.fillRect(x * CARD_WIDTH, y * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT);
        });

        // Draw current position
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; // Semi-transparent red
        ctx.fillRect(currentPos.x * CARD_WIDTH, currentPos.y * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT);

        ctx.restore();
    };

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
            if (newX < -2 || newX > COLS + 1 || newY < -2 || newY > ROWS + 1) continue;

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

        // Visualize current exploration
        visualizeExploration({x, y}, visited);
    }

    return null;  // No valid path found
}

function drawPath(path) {
    if (!path || path.length < 2) return;

    ctx.save();
    
    // Add semi-transparent overlay just for the board area
    ctx.fillStyle = 'rgba(0, 0, 0, 00)';
    ctx.fillRect(0, 0, COLS * CARD_WIDTH, ROWS * CARD_HEIGHT);

    // Draw the path with glow effect
    ctx.shadowColor = 'yellow';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#feffdaff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the main path
    ctx.beginPath();

    // Helper function to handle off-board coordinates
    const getVisibleCoord = (point) => {
        const x = point.x * CARD_WIDTH + CARD_WIDTH/2;
        const y = point.y * CARD_HEIGHT + CARD_HEIGHT/2;
        
        // If point is off-board, clamp it to board edge
        return {
            x: Math.max(CARD_WIDTH/2, Math.min(x, (COLS - 0.5) * CARD_WIDTH)),
            y: Math.max(CARD_HEIGHT/2, Math.min(y, (ROWS - 0.5) * CARD_HEIGHT))
        };
    };

    // Start path
    const start = getVisibleCoord(path[0]);
    ctx.moveTo(start.x, start.y);

    // Draw path segments with arrows for off-board sections
    for (let i = 1; i < path.length; i++) {
        const prev = path[i-1];
        const curr = path[i];
        const visiblePoint = getVisibleCoord(curr);
        
        ctx.lineTo(visiblePoint.x, visiblePoint.y);

        // If point is off-board, draw an arrow
        if (curr.x < 0 || curr.x >= COLS || curr.y < 0 || curr.y >= ROWS) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.translate(visiblePoint.x, visiblePoint.y);
            
            // Calculate arrow rotation based on direction
            const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            ctx.rotate(angle);
            
            // Draw arrow
            ctx.beginPath();
            ctx.moveTo(-10, -10);
            ctx.lineTo(10, 0);
            ctx.lineTo(-10, 10);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
    }
    ctx.stroke();

    // Draw points
    path.forEach((point, i) => {
        const visiblePoint = getVisibleCoord(point);
        ctx.beginPath();
        ctx.fillStyle = i === 0 ? '#73ED77FF' : 
                       i === path.length - 1 ? '#73ED77FF' : '#ffff00';
        ctx.arc(visiblePoint.x, visiblePoint.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();
}

async function handleClick(event) {
    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    // Handle touch events
    if (event.type === 'touchstart' || event.type === 'touchend') {
        const touch = event.changedTouches[0];
        clientX = touch.clientX - window.scrollX;
        clientY = touch.clientY - window.scrollY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    // Calculate relative position within canvas
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // Calculate card position
    const x = Math.floor((relativeX / rect.width) * COLS);
    const y = Math.floor((relativeY / rect.height) * ROWS);

    // Bounds checking
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
        console.log('Click outside board bounds');
        return;
    }

    if (board[y][x]) {
        if (selectedCards.length === 1 && x === selectedCards[0].x && y === selectedCards[0].y) {
            selectedCards = [];
            drawBoard();
        } else if (selectedCards.length === 1) {
            const first = selectedCards[0];
            
            if (board[first.y][first.x] === board[y][x]) {
                try {
                    const path = await findPath(first.x, first.y, x, y);
                    
                    if (path) {
                        selectedCards.push({x, y});
                        drawBoard();
                        drawPath(path);
                        
                        setTimeout(async () => {
                            board[first.y][first.x] = null;
                            board[y][x] = null;

                            // Update time and trigger flash
                            const timerBar = document.getElementById('timer-bar');
                            timeRemaining += TIME_BONUS;
                            
                            if (timerBar) {
                                // Remove existing class to ensure animation can replay
                                timerBar.classList.remove('timer-flash');
                                // Force a reflow
                                void timerBar.offsetWidth;
                                // Add class back
                                timerBar.classList.add('timer-flash');
                            }

                            score += 10;
                            if (timeRemaining > INITIAL_TIME) {
                                score += Math.floor(timeRemaining - INITIAL_TIME);
                                timeRemaining = INITIAL_TIME + 1;
                            }
                            scoreElement.textContent = score;
                            drawBoard();

                            // Check for win condition
                            if (checkGameComplete()) {
                                clearInterval(timerInterval);
                                createConfetti();
                                setTimeout(() => {
                                    alert(`Поздравляем! Вы победили!\nВаш счёт: ${score} очков`);
                                    if (confirm('Хотите сыграть ещё раз?')) {
                                        resetGame();
                                    }
                                }, 500); // Small delay to ensure confetti starts first
                            }
                        }, 1000);
                        
                        selectedCards = [];
                    } else {
                        selectedCards = [];
                        drawBoard();
                    }
                } catch (error) {
                    console.error('Path finding error:', error);
                    selectedCards = [];
                    drawBoard();
                }
            } else {
                selectedCards = [];
                drawBoard();
            }
        } else {
            selectedCards.push({x, y});
            drawBoard();
        }
    }
}

// Update event listeners
canvas.removeEventListener('click', handleClick);
canvas.removeEventListener('touchstart', handleClick);
canvas.addEventListener('touchstart', handleClick, { passive: false });
canvas.addEventListener('click', handleClick);

// Add new function to update timer
function updateTimer() {
    const timerBar = document.getElementById('timer-bar');
    if (!timerBar) return;

    // Decrease time more smoothly (adjust time by frame)
    timeRemaining -= 1/60; // Decrease by 1 second spread across 60 frames

    // Update progress bar immediately
    const percentage = (timeRemaining / INITIAL_TIME) * 100;
    timerBar.style.width = `${percentage}%`;
    
    // Flash only when time is added
    if (timeRemaining > INITIAL_TIME - TIME_BONUS && timeRemaining > prevTimeRemaining) {
        timerBar.classList.remove('timer-flash');
        void timerBar.offsetWidth;
        timerBar.classList.add('timer-flash');
    }
    
    if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        if (board && board.length > 0) {
            alert('Время вышло!');
            if (confirm('Хотите сыграть ещё?')) {
                resetGame();
            }
        }
    }
    
    prevTimeRemaining = timeRemaining;
}

// Add reset game function
function resetGame() {
    score = 0;
    scoreElement.textContent = score;
    timeRemaining = INITIAL_TIME;
    clearInterval(timerInterval);
    initGame();
}

// Modify initGame function to return a promise
async function initGame() {
    try {
        // Clear any existing timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        // Reset game state
        timeRemaining = INITIAL_TIME;
        score = 0;
        if (scoreElement) {
            scoreElement.textContent = score;
        }

        // Initialize game components
        await generateRandomGradient();
        await preloadImages();
        initializeBoard();
        drawBoard();

        // Start timer with more frequent updates
        timerInterval = setInterval(() => {
            if (board && board.length > 0) {
                updateTimer();
            } else {
                clearInterval(timerInterval);
            }
        }, 1000/60); // Update ~60 times per second

    } catch (error) {
        console.error('Error initializing game:', error);
    }
}

// Modify checkGameComplete to include safety checks
function checkGameComplete() {
    if (!board) return false;
    
    for (let i = 0; i < board.length; i++) {
        if (!board[i]) continue; // Skip if row is undefined
        
        for (let j = 0; j < board[i].length; j++) {
            if (board[i][j] !== null) {
                return false;
            }
        }
    }
    return true;
}

// Add window.onload to ensure DOM is ready
window.onload = function() {
    initGame().catch(error => {
        console.error('Failed to initialize game:', error);
    });
};

function createConfetti() {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const confettiCount = 450;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random properties for each piece
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100; // Random position across screen
        const size = Math.random() * 10 + 5; // Random size between 5-15px
        const duration = Math.random() * 3 + 2; // Random animation duration 2-5s
        const delay = Math.random() * 0.5; // Random start delay
        
        confetti.style.cssText = `
            position: fixed;
            left: ${left}vw;
            top: -20px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            transform: rotate(${Math.random() * 360}deg);
            animation: confetti ${duration}s ease-in ${delay}s forwards;
            z-index: 1000;
        `;
        
        document.body.appendChild(confetti);
        
        // Remove confetti after animation
        setTimeout(() => confetti.remove(), (duration + delay) * 1000);
    }
}

let prevTimeRemaining = INITIAL_TIME;
