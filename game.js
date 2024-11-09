const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const CARD_WIDTH = 50;  
const CARD_HEIGHT = 50;
const CHARACTER_COUNT = 26;

// Game configuration
let INITIAL_TIME = 90;
let TIME_BONUS = 6; 
let ROWS = 8;
let COLS = 14;


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
    
    // Get current difficulty setting
    const difficulty = document.getElementById('difficulty').value;
    const availableCharacters = characters.slice(0, DIFFICULTY[difficulty]);
    
    // Keep adding pairs until we fill the board
    while (cardPairs.length < totalCells) {
        const char = availableCharacters[currentIndex % availableCharacters.length];
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

                            // Apply level-specific behavior
                            handlePostMatchBehavior();

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

                            let pointsEarned = 10;
                            score += pointsEarned;
                            showFloatingScore(pointsEarned);

                            if (timeRemaining > INITIAL_TIME) {
                                const bonusPoints = Math.floor(timeRemaining - INITIAL_TIME);
                                score += bonusPoints;
                                if (bonusPoints > 0) {
                                    setTimeout(() => showFloatingScore(bonusPoints), 200); // Slight delay for second animation
                                }
                                timeRemaining = INITIAL_TIME + 1;
                            }
                            scoreElement.textContent = score;
                            drawBoard();

                            // Check for win condition
                            if (checkGameComplete()) {
                                clearInterval(timerInterval);
                                createConfetti();
                                setTimeout(() => {
                                    const isLastLevel = currentLevel === Object.keys(LEVELS).length;
                                    const message = isLastLevel 
                                        ? `Поздравляем! Вы прошли все уровни!\nВаш счёт: ${score} очков` 
                                        : `Поздравляем! Уровень ${currentLevel} пройден!\nВаш счёт: ${score} очков\nГотовы к уровню ${currentLevel + 1}?`;
                                    
                                    if (isLastLevel) {
                                        if (confirm('Хотите начать сначала?')) {
                                            currentLevel = 1;
                                            resetGame();
                                        }
                                    } else {
                                        if (confirm('Перейти к следующему уровню?')) {
                                            advanceToNextLevel();
                                            resetGame();
                                        }
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
    // Clear existing intervals
    if (timerInterval) clearInterval(timerInterval);
    
    // Reset game state
    timeRemaining = INITIAL_TIME;
    score = 0;
    selectedCards = [];
    board = [];
    
    // Update score display
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.textContent = '0';
    
    // Initialize canvas dimensions
    initializeCanvas();
    
    // Initialize board with new dimensions
    initializeBoard();
    
    // Reset and start timer
    const timerBar = document.getElementById('timer-bar');
    if (timerBar) {
        timerBar.style.width = '100%';
    }
    
    timerInterval = setInterval(() => {
        if (board && board.length > 0) {
            updateTimer();
        } else {
            clearInterval(timerInterval);
        }
    }, 1000/60);
    
    drawBoard();
    updateLevelIndicator();
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

        // Initialize canvas dimensions
        initializeCanvas();

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
    initializeControlPanel();
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

function showFloatingScore(points) {
    const scoreContainer = document.getElementById('score-container');
    const floatingText = document.createElement('div');
    floatingText.className = 'floating-score';
    floatingText.textContent = `+${points}`;
    
    // Position the floating text next to the score container
    const rect = scoreContainer.getBoundingClientRect();
    floatingText.style.left = `${rect.right + 10}px`;
    floatingText.style.top = `${rect.top}px`;
    
    document.body.appendChild(floatingText);
    
    // Remove the element after animation completes
    setTimeout(() => floatingText.remove(), 1500);
}



// Control panel functionality
function initializeControlPanel() {
    const panel = document.getElementById('control-panel');
    const toggleBtn = document.getElementById('toggle-panel');
    const panelContent = panel.querySelector('.panel-content');
    const restartBtn = document.getElementById('restart-game');
    const defaultsBtn = document.getElementById('restore-defaults');
    
    // Ensure panel starts collapsed
    panelContent.style.display = 'none';
    
    // Toggle panel
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panelContent.style.display = panelContent.style.display === 'none' ? 'block' : 'none';
    });
    
    // Load saved settings first
    loadSettings();
    
    // Initialize input values with loaded settings
    document.getElementById('initial-time').value = INITIAL_TIME;
    document.getElementById('time-bonus').value = TIME_BONUS;
    document.getElementById('rows').value = ROWS;
    document.getElementById('cols').value = COLS;
    
    // Restore defaults button
    function handleDefaultsClick(e) {
        // Prevent double execution
        if (e.defaultsPrevented) return;
        e.defaultsPrevented = true;
        
        console.log('Default button clicked'); // Debug log
        if (confirm('Вы уверены, что хотите восстановить настройки по умолчанию?')) {
            restoreDefaultSettings();
        }
        
        // Reset the flag after a short delay
        setTimeout(() => {
            e.defaultsPrevented = false;
        }, 100);
    }
    
    defaultsBtn.removeEventListener('click', handleDefaultsClick);
    defaultsBtn.addEventListener('click', handleDefaultsClick);
    
    // Update settings and restart game
    restartBtn.addEventListener('click', () => {
        INITIAL_TIME = parseInt(document.getElementById('initial-time').value);
        TIME_BONUS = parseInt(document.getElementById('time-bonus').value);
        ROWS = parseInt(document.getElementById('rows').value);
        COLS = parseInt(document.getElementById('cols').value);
        
        // Ensure even number of cells
        if ((ROWS * COLS) % 2 !== 0) {
            COLS += 1;
        }
        
        // Save the new settings
        saveSettings();
        
        // Update canvas size
        canvas.width = COLS * CARD_WIDTH * PIXEL_RATIO;
        canvas.height = ROWS * CARD_HEIGHT * PIXEL_RATIO;
        canvas.style.width = COLS * CARD_WIDTH + 'px';
        canvas.style.height = ROWS * CARD_HEIGHT + 'px';
        ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
        
        resetGame();
        panelContent.style.display = 'none';
    });
}

// Call this at the end of your window.onload or where you initialize the game
window.addEventListener('load', function() {
    initializeControlPanel();
    resetGame();
});

// Add this near the top of your game.js with other initialization code
document.getElementById('toggle-panel').addEventListener('click', () => {
    const panelContent = document.getElementById('control-panel').querySelector('.panel-content');
    panelContent.style.display = panelContent.style.display === 'none' ? 'block' : 'none';
});

// Add event listeners for the control inputs
document.getElementById('initial-time').value = INITIAL_TIME;
document.getElementById('time-bonus').value = TIME_BONUS;
document.getElementById('rows').value = ROWS;
document.getElementById('cols').value = COLS;

document.getElementById('restart-game').addEventListener('click', resetGame);

// Add input change handlers
document.getElementById('initial-time').addEventListener('change', (e) => {
    INITIAL_TIME = parseInt(e.target.value);
});

document.getElementById('time-bonus').addEventListener('change', (e) => {
    TIME_BONUS = parseInt(e.target.value);
});

document.getElementById('rows').addEventListener('change', (e) => {
    ROWS = parseInt(e.target.value);
});

document.getElementById('cols').addEventListener('change', (e) => {
    COLS = parseInt(e.target.value);
});

// Add these functions to handle saving and loading settings
function saveSettings() {
    const settings = {
        initialTime: INITIAL_TIME,
        timeBonus: TIME_BONUS,
        rows: ROWS,
        cols: COLS,
        difficulty: document.getElementById('difficulty').value
    };
    localStorage.setItem('gameSettings', JSON.stringify(settings));
}

function loadSettings() {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        INITIAL_TIME = settings.initialTime;
        TIME_BONUS = settings.timeBonus;
        ROWS = settings.rows;
        COLS = settings.cols;
        document.getElementById('difficulty').value = settings.difficulty || 'MEDIUM';
    }
}

// Add default settings constants
const DEFAULT_SETTINGS = {
    initialTime: 90,
    timeBonus: 6,
    rows: 8,
    cols: 14,
    difficulty: 'MEDIUM'  // Add default difficulty
};

function restoreDefaultSettings() {
    // Update global variables
    INITIAL_TIME = DEFAULT_SETTINGS.initialTime;
    TIME_BONUS = DEFAULT_SETTINGS.timeBonus;
    ROWS = DEFAULT_SETTINGS.rows;
    COLS = DEFAULT_SETTINGS.cols;
    
    // Update input values
    document.getElementById('initial-time').value = INITIAL_TIME;
    document.getElementById('time-bonus').value = TIME_BONUS;
    document.getElementById('rows').value = ROWS;
    document.getElementById('cols').value = COLS;
    document.getElementById('difficulty').value = DEFAULT_SETTINGS.difficulty;
    
    // Clear localStorage
    localStorage.removeItem('gameSettings');
}

// Update level configuration
const LEVELS = {
    1: {
        name: "Classic",
        description: "Classic matching game",
        behavior: "default"
    },
    2: {
        name: "Sliding Right",
        description: "Cards slide right after matches",
        behavior: "slideRight"
    },
    3: {
        name: "Falling Down",
        description: "Cards fall down after matches",
        behavior: "slideDown"
    },
    4: {
        name: "Sliding Left",
        description: "Cards slide left after matches",
        behavior: "slideLeft"
    }
};

let currentLevel = 1;

function updateLevelIndicator() {
    const levelNumber = document.getElementById('current-level');
    const levelName = document.getElementById('level-name');
    if (levelNumber && levelName) {
        levelNumber.textContent = currentLevel;
        levelName.textContent = LEVELS[currentLevel].name;
    }
}

// Modify the advanceToNextLevel function
function advanceToNextLevel() {
    if (currentLevel < Object.keys(LEVELS).length) {
        currentLevel++;
        document.getElementById('level').value = currentLevel;
        updateLevelIndicator();
        console.log(`Advancing to level ${currentLevel}: ${LEVELS[currentLevel].name}`);
        saveSettings();
    }
}

// Update the handlePostMatchBehavior function to use the current level's behavior
function handlePostMatchBehavior() {
    switch (currentLevel) {
        case 2: // Slide Right
            for (let row = 0; row < ROWS; row++) {
                let hasChanges;
                do {
                    hasChanges = false;
                    for (let col = COLS - 2; col >= 0; col--) {
                        if (board[row][col] !== null && board[row][col + 1] === null) {
                            board[row][col + 1] = board[row][col];
                            board[row][col] = null;
                            hasChanges = true;
                        }
                    }
                } while (hasChanges);
            }
            break;

        case 3: // Slide Down
            let hasChanges;
            do {
                hasChanges = false;
                for (let row = ROWS - 2; row >= 0; row--) {
                    for (let col = 0; col < COLS; col++) {
                        if (board[row][col] !== null && board[row + 1][col] === null) {
                            board[row + 1][col] = board[row][col];
                            board[row][col] = null;
                            hasChanges = true;
                        }
                    }
                }
            } while (hasChanges);
            break;

        case 4: // Slide Left
            for (let row = 0; row < ROWS; row++) {
                let hasChanges;
                do {
                    hasChanges = false;
                    for (let col = 1; col < COLS; col++) {
                        if (board[row][col] !== null && board[row][col - 1] === null) {
                            board[row][col - 1] = board[row][col];
                            board[row][col] = null;
                            hasChanges = true;
                        }
                    }
                } while (hasChanges);
            }
            break;

        default: // Level 1 - Classic (no movement)
            break;
    }
}

// Modify the checkWinCondition function
function checkWinCondition() {
    const allMatched = board.every(row => row.every(cell => cell === null));
    if (allMatched) {
        clearInterval(timerInterval);
        const isLastLevel = currentLevel === Object.keys(LEVELS).length;
        
        const message = isLastLevel 
            ? 'Congratulations! You\'ve completed all levels! Want to play again?' 
            : `Congratulations! Ready for Level ${currentLevel + 1}?`;
            
        const confirmAction = confirm(message);
        
        if (confirmAction) {
            if (isLastLevel) {
                currentLevel = 1; // Reset to first level
            } else {
                advanceToNextLevel();
            }
            resetGame();
        }
    }
}

document.getElementById('difficulty').addEventListener('change', (e) => {
    saveSettings();
});

function initializeCanvas() {
    // Set the canvas size to match the game board dimensions with pixel ratio
    canvas.width = COLS * CARD_WIDTH * PIXEL_RATIO;
    canvas.height = ROWS * CARD_HEIGHT * PIXEL_RATIO;

    // Set display size (CSS pixels)
    canvas.style.width = COLS * CARD_WIDTH + 'px';
    canvas.style.height = ROWS * CARD_HEIGHT + 'px';

    // Scale the context to handle the pixel ratio
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

    // Enable high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

document.getElementById('level').addEventListener('change', (e) => {
    currentLevel = parseInt(e.target.value);
    updateLevelIndicator();
    saveSettings();
    resetGame();
});
