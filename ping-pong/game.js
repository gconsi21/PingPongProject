import * as THREE from 'https://unpkg.com/three/build/three.module.js';
//import CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';
let gameMode = false;
let aiReactionTime = 20;
let lastLaunchTime = 0;
let hasBallHitTable = false;

function init() {
    const existingCanvas = document.querySelector('canvas');
    if (existingCanvas) {
        existingCanvas.parentNode.removeChild(existingCanvas);
    }

    const clock = new THREE.Clock();
    let scorePlayer1 = 0;
    let scorePlayer2 = 0;

    const scene = new THREE.Scene();
    let currentCamera; // This will allow us to switch between cameras
    const camera1 = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera1.position.set(3, 1, 2);  // Side view
    camera1.lookAt(new THREE.Vector3(0, 0, 0));

    const camera2 = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera2.position.set(0, 4, 0);  // Top view, looking down
    camera2.lookAt(new THREE.Vector3(0, 0, 0));

    currentCamera = camera1; // Start with the first camera

    function switchCamera() {
        currentCamera = (currentCamera === camera1) ? camera2 : camera1;
        console.log('Camera switched:', currentCamera === camera1 ? 'camera1' : 'camera2');
    }


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    document.body.appendChild(renderer.domElement);


    const keyStates = {};

    document.addEventListener('keydown', (event) => {
        keyStates[event.key] = true;
    });
    
    document.addEventListener('keyup', (event) => {
        keyStates[event.key] = false;
    });
    

    // Physics world setup
    const world = new CANNON.World();
    world.gravity.set(0, -0.1, 0);
    world.broadphase = new CANNON.NaiveBroadphase();

    const loader = new THREE.TextureLoader();
loader.load('./beach_background.jpg', function(texture) {
    scene.background = texture;  // This sets the texture as the background of the scene
});

    // Paddle Material
    const rubberTexture = loader.load('rubber_texture.jpg');
    const handleTexture = loader.load('handle_texture.jpg');
    const paddleMaterial = new THREE.MeshPhongMaterial({ map: rubberTexture, side: THREE.DoubleSide });
    const handleMaterial = new THREE.MeshPhongMaterial({ map: handleTexture });

    // Paddle Geometry
    const rubberDiameter = 0.25;  // meters, diameter of the circular rubber
    const rubberThickness = 0.04;  // meters, thickness of the rubber part
    const handleDiameter = 0.04;   // meters, the diameter of the cylindrical handle
    const handleLength = 0.18;      // meters, the length of the handle

    // Rubber paddle
    const rubberGeometry = new THREE.CylinderGeometry(rubberDiameter/2, rubberDiameter/2, rubberThickness, 32);
    const rubber = new THREE.Mesh(rubberGeometry, paddleMaterial);
    rubber.rotation.z = Math.PI / 2;  // Rotate to face along the Z-axis
    rubber.castShadow = true;  // Enable casting shadows
    rubber.receiveShadow = true;  // Enable receiving shadows

    // Handle
    const handleGeometry = new THREE.CylinderGeometry(handleDiameter/2, handleDiameter/2, handleLength, 32);
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -handleLength / 2 - rubberThickness / 2;
    handle.castShadow = true;  // Enable casting shadows
    handle.receiveShadow = true;  // Enable receiving shadows

    // Group for paddle
    const paddle1 = new THREE.Group();
    paddle1.add(rubber);
    paddle1.add(handle);
    paddle1.position.set(-1, 0, 0);
    paddle1.castShadow = true;  // Enable casting shadows
    paddle1.receiveShadow = true;  // Enable receiving shadows

    const paddle2 = paddle1.clone();
    paddle2.position.set(1, 0, 0);

    scene.add(paddle1);
    scene.add(paddle2);

    // Paddle physics (simplified as a larger sphere for interactions)
    const paddleShape = new CANNON.Sphere(rubberDiameter / 2);
    const paddleBody1 = new CANNON.Body({ mass: 0, shape: paddleShape });
    const paddleBody2 = new CANNON.Body({ mass: 0, shape: paddleShape });
    world.addBody(paddleBody1);
    world.addBody(paddleBody2);
    paddleBody1.position.copy(paddle1.position);
    paddleBody2.position.copy(paddle2.position);
    let currentServingPaddle = paddle2; // default starting paddle


    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.color.setHex(0xfadca7);
    directionalLight.position.set(-2, 2, -1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);


    const tableTexture = loader.load('./table_texture.jpg');

    // Table setup
    const tableLength = 2.74;
    const tableWidth = 1.525;
    const tableHeight = 0.76;
    const tableGeometry = new THREE.BoxGeometry(tableLength, 0.05, tableWidth);
    const tableMaterial = new THREE.MeshPhongMaterial({
        map: tableTexture, // Apply the loaded texture
        side: THREE.DoubleSide
    });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(0, -tableHeight / 2, 0);
    scene.add(table);

    // Table physics
    const tableShape = new CANNON.Box(new CANNON.Vec3(tableLength / 2, 0.025, tableWidth / 2));
    const tableBody = new CANNON.Body({ mass: 0, shape: tableShape });
    world.addBody(tableBody);
    tableBody.position.copy(table.position);

    scene.add(table);
    world.addBody(tableBody);

 // Load the texture with a callback to check if it loads correctly
loader.load('./net.png', function(texture) {
    console.log("Texture loaded successfully");

    const netMaterial = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        opacity: 1,  // Adjust opacity to make sure it's visible
        side: THREE.DoubleSide
    });

    // Net dimensions and position adjustment
    const netHeight = 0.3;  // Adjust as necessary
    const netWidth = 0.02;
    const netLength = tableWidth;  // Assuming 'tableWidth' is defined and accurate

    // Create net geometry
    const netGeometry = new THREE.PlaneGeometry(netLength, netHeight);
    const net = new THREE.Mesh(netGeometry, netMaterial);
    net.position.set(0, -tableHeight / 2 + netHeight / 2, 0);  // Ensure it's positioned at the middle of the table
    net.rotation.y = Math.PI / 2;
    net.castShadow = true;

    // Add net to scene
    scene.add(net);
}, undefined, function(error) {
    console.error("Error loading the texture:", error);
});

    // Define materials and contact materials
    const bouncyMaterial = new CANNON.Material("bouncyMaterial");
    const tableMaterialCannon = new CANNON.Material("tableMaterial");
    const bouncyContactMaterial = new CANNON.ContactMaterial(bouncyMaterial, bouncyMaterial, {
        restitution: 0.9,
        friction: 0.2
    });
    const tableContactMaterial = new CANNON.ContactMaterial(tableMaterialCannon, bouncyMaterial, {
        restitution: 0.7,
        friction: 0.1
    });

    // Add contact materials to the world
    world.addContactMaterial(bouncyContactMaterial);
    world.addContactMaterial(tableContactMaterial);

    // Apply materials to bodies
    tableBody.material = tableMaterialCannon;

    
    // Ball setup
    let initialBallPosition;
    const ballSpeed = 0.7; // Speed at which the ball should move
    const ballRadius = 0.02;
    const ballShape = new CANNON.Sphere(ballRadius);
    const ballBody = new CANNON.Body({ mass: 0.02, shape: ballShape });
    ballBody.allowSleep = true;
    ballBody.sleep();
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xFFFFFF,
        specular: 0x111111,
        shininess: 100 
    });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    initialBallPosition = new THREE.Vector3(paddle2.position.x, paddle2.position.y + handleLength + ballRadius, paddle2.position.z);
ball.position.set(initialBallPosition.x, initialBallPosition.y, initialBallPosition.z);

    scene.add(ball);
    ballBody.addEventListener("collide", function(e) {
        if (e.body === tableBody) {
            hasBallHitTable = true;
            console.log("Ball has hit the table");
        }
    
        const velocityLength = ballBody.velocity.length();
    if (velocityLength !== 0) {
        ballBody.velocity.normalize(); // Normalize to get direction
        ballBody.velocity.scale(ballSpeed, ballBody.velocity); // Scale to desired speed
    }
    });

    // Let the ball cast shadows
    ball.castShadow = true;

    // Let the table receive shadows
    table.receiveShadow = true;



// Assign this material to the ball and paddles
ballBody.material = bouncyMaterial;
paddleBody1.material = bouncyMaterial;
paddleBody2.material = bouncyMaterial;


    // Ball physics
    world.addBody(ballBody);
    ballBody.position.copy(ball.position);

    function updatePhysics() {
        world.step(1 / 60);

        // Update Three.js meshes from Cannon.js bodies
        ball.position.copy(ballBody.position);
        ball.quaternion.copy(ballBody.quaternion);
        paddle1.position.copy(paddleBody1.position);
        paddle1.quaternion.copy(paddleBody1.quaternion);
        paddle2.position.copy(paddleBody2.position);
        paddle2.quaternion.copy(paddleBody2.quaternion);
    }
    function updatePaddlePosition(deltaTime) {
        const paddleSpeed = 2; // meters per second
        if (!gameMode){
        if (keyStates['a']) {
            paddle1.position.z += paddleSpeed * deltaTime;
            paddleBody1.position.z = paddle1.position.z;
        }
        if (keyStates['d']) {
            paddle1.position.z -= paddleSpeed * deltaTime;
            paddleBody1.position.z = paddle1.position.z;
        }
        if (keyStates['w']) {
            paddle1.position.y += paddleSpeed * deltaTime;
            paddleBody1.position.y = paddle1.position.y;
        }
        if (keyStates['s']) {
            paddle1.position.y -= paddleSpeed * deltaTime;
            paddleBody1.position.y = paddle1.position.y;
        }
        }
        if (keyStates['ArrowLeft']) {
            paddle2.position.z += paddleSpeed * deltaTime;
            paddleBody2.position.z = paddle2.position.z;
        }
        if (keyStates['ArrowRight']) {
            paddle2.position.z -= paddleSpeed * deltaTime;
            paddleBody2.position.z = paddle2.position.z;
        }
        if (keyStates['ArrowUp']) {
            paddle2.position.y += paddleSpeed * deltaTime;
            paddleBody2.position.y = paddle2.position.y;
        }
        if (keyStates['ArrowDown']) {
            paddle2.position.y -= paddleSpeed * deltaTime;
            paddleBody2.position.y = paddle2.position.y;
        }
    }
    

// Initialize the ball's position relative to paddle2 and make it stationary
ballBody.position.set(paddle2.position.x, paddle2.position.y, paddle2.position.z + 0.1);
ballBody.velocity.set(0, 0, 0);
ballBody.gravityScale = 0;  // Disable gravity effect on the ball initially
let ballInPlay = false;
document.addEventListener('keydown', function(event) {
    if (event.key === ' ' && !ballInPlay) {
        launchBall(currentServingPaddle);
        ballInPlay = true;
    }
});

function launchBall(currentServingPaddle) {
    hasBallHitTable = false;
    lastLaunchTime = Date.now();
    ballInPlay = true;
    ballBody.wakeUp();
    ballBody.gravityScale = 1;
    var launchSpeed;
    // Enable gravity when the ball is in play
    if(currentServingPaddle == paddle2){
        launchSpeed = -1;
    } // Negative speed to move towards paddle1
    else{
        launchSpeed = 1;
    }
    ballBody.velocity.set(launchSpeed, -1, 0);
}
function updateBallPosition() {
    if (!ballInPlay) {
        // Position the ball at the correct serving position based on the current serving paddle
        ballBody.position.set(currentServingPaddle.position.x, currentServingPaddle.position.y + handleLength + ballRadius, currentServingPaddle.position.z);
    }
}
function updateAI(deltaTime) {
    if (!gameMode || !ballInPlay || (Date.now() - lastLaunchTime < aiReactionTime)) {
        return;
    }
    let aiPaddle = paddle1;
    let aiPaddleBody = paddleBody1; 
    let aiSpeedZ = 1;  // Speed for z-axis movement
    let aiSpeedY = 1;  // Speed for y-axis movement

    let targetZ = ball.position.z;  // Target z position is the ball's current z position
    let targetY = ball.position.y;  // Target y position is the ball's current y position

    // Update z position
    if (aiPaddle.position.z < targetZ) {
        aiPaddle.position.z += aiSpeedZ * deltaTime;
    } else if (aiPaddle.position.z > targetZ) {
        aiPaddle.position.z -= aiSpeedZ * deltaTime;
    }

    // Update y position
    if (aiPaddle.position.y < targetY) {
        aiPaddle.position.y += aiSpeedY * deltaTime;
    } else if (aiPaddle.position.y > targetY) {
        aiPaddle.position.y -= aiSpeedY * deltaTime;
    }

    // Apply the calculated positions to both the physics body and the visual mesh
    aiPaddleBody.position.z = aiPaddle.position.z;
    aiPaddleBody.position.y = aiPaddle.position.y;
}



function checkBallOutOfBounds() {
    //check to see if the ball hits the table to award point
    if ((ballBody.position.x > tableLength / 2 || ballBody.position.x < -tableLength / 2) && !hasBallHitTable) {
        if (currentServingPaddle === paddle1) {
            scorePlayer2++;
            resetBallAndPaddles(paddle2)
            ballBody.sleep();
        } else {
            scorePlayer1++;
            resetBallAndPaddles(paddle1)
            ballBody.sleep();
        }
    // Check if the ball falls off the ends of the table where the paddles are located
    } else if (ballBody.position.x > 2) {
        scorePlayer1++;
        // Ball went out on the side of paddle2
        resetBallAndPaddles(paddle1); // Reset to the opposite side, which is paddle1
        ballBody.sleep();
    } else if (ballBody.position.x < -2) {
        // Ball went out on the side of paddle1
        scorePlayer2++;
        resetBallAndPaddles(paddle2); // Reset to the opposite side, which is paddle2
        ballBody.sleep();
    } else if (ballBody.position.z > 5) {
        resetBallAndPaddles(paddle1)
        ballBody.sleep();
    } else if (ballBody.position.z < -5) {
        resetBallAndPaddles(paddle1)
        ballBody.sleep();
    }
    updateScoreboard();
    if (scorePlayer1 >= 10 || scorePlayer2 >= 10) {
        displayWinner(scorePlayer1 >= 10 ? "Player 1 Wins!" : "Player 2 Wins!");
        showPlayAgainButton();
    }
}

//Scoreboard and check for winner
function updateScoreboard() {
    document.getElementById('Player1').textContent = scorePlayer1;
    document.getElementById('Player2').textContent = scorePlayer2;
    
    // Check if either player has won
    if ((scorePlayer1 >= 11 || scorePlayer2 >= 11) && Math.abs(scorePlayer1 - scorePlayer2) >= 2) {
        let winnerMessage = scorePlayer1 >= 11 ? "Player1 Wins!" : "Player2 Wins!";
        displayWinner(winnerMessage);
        showPlayAgainButton();
    }
}


function displayWinner(winner) {
    const winnerDiv = document.getElementById('winnerMessage');
    const gameWinner = document.getElementById('gameWinner');  // Ensure this ID exists in your HTML
    const playAgainButton = document.getElementById('playAgainButton');

    if (winnerDiv && gameWinner && playAgainButton) {
        gameWinner.textContent = winner;
        winnerDiv.style.display = 'flex'; // Show the winner message
        playAgainButton.style.display = 'block'; // Show the Play Again button
    } else {
        console.error("Some elements are missing in the HTML");
    }
}

// This function could be improved by ensuring it only shows when needed
function showPlayAgainButton() {
    const playAgainButton = document.getElementById('playAgainButton');
    if (playAgainButton) { // Check if the element exists
        playAgainButton.style.display = 'block';
        playAgainButton.onclick = function() {
            resetGame();
            document.getElementById('winnerMessage').style.display = 'none'; // Hide the winner message
            playAgainButton.style.display = 'none'; // Hide button after clicking
        };
    } else {
        console.error("Play Again button not found!");
    }
}


function resetBallAndPaddles(paddle) {
    currentServingPaddle = paddle;

    // Reset the ball position near the specified paddle
    let ballStartPositionY = paddle.position.y + handleLength + rubberThickness / 2 + ballRadius;  // Adjusting this calculation
    ballBody.position.set(paddle.position.x, ballStartPositionY, paddle.position.z);    
    ballBody.velocity.set(0, 0, 0);
    ballBody.gravityScale = 0; // Turn off gravity until the ball is launched again
    ballInPlay = false;

    // Reset paddles
    paddleBody1.position.set(-1, 0, 0);
    paddleBody2.position.set(1, 0, 0);
}



//physics
function updatePhysics() {
    world.step(1 / 60); // Step the physics world forward
    ball.position.copy(ballBody.position);
    ball.quaternion.copy(ballBody.quaternion);

    // Check lateral bounds for the ball
    if (Math.abs(ballBody.position.z) > tableWidth / 2 - ballRadius) {
        ballBody.position.x = Math.sign(ballBody.position.x) * (tableWidth / 2 - ballRadius); // Adjust position slightly inside the bounds
        ballBody.velocity.x *= -1; // Reflect the ball's velocity to keep it in play
    }

    // Update Three.js objects from Cannon.js bodies
    ball.position.copy(ballBody.position);
    ball.quaternion.copy(ballBody.quaternion);
    paddle1.position.copy(paddleBody1.position);
    paddle2.position.copy(paddleBody2.position);

    // Check if the ball falls off the ends
    checkBallOutOfBounds();
}

// Preload backgrounds
const backgrounds = ['./beach_background.jpg', './city_background.jpg'];
let currentBackgroundIndex = 0;  // Start with the first background

function toggleBackground() {
    const backgrounds = ['./beach_background.jpg', './city_background.jpg'];
    currentBackgroundIndex = (currentBackgroundIndex + 1) % backgrounds.length;
    document.body.style.backgroundImage = `url('${backgrounds[currentBackgroundIndex]}')`;
    console.log("Background switched to:", backgrounds[currentBackgroundIndex]);
}



// Setup event listener for the background toggle button
document.addEventListener('DOMContentLoaded', function() {
    const backgroundButton = document.getElementById('backgroundButton');
    if (backgroundButton) {
        backgroundButton.addEventListener('click', toggleBackground);
        console.log('Event listener attached to background toggle button.');
    } else {
        console.log('Background toggle button not found.');
    }
});



function resetGame() {
    // Reset the ball
    ballBody.position.set(paddle2.position.x, paddle2.position.y + handleLength + ballRadius, paddle2.position.z);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.gravityScale = 0;
    ballInPlay = false;

    // Reset paddles
    paddleBody1.position.set(-1, 0, 0);
    paddleBody2.position.set(1, 0, 0);

    // Reset scores
    scorePlayer1 = 0;
    scorePlayer2 = 0;
    updateScoreboard();
    // Optionally hide the start menu if you use it when game restarts
    document.getElementById('startMenu').style.display = 'none'; 
}

function backToHome() {
    resetGame(); // This resets the game state
    document.getElementById('startMenu').style.display = 'flex'; // Show the start menu
}

function setupHomeButton() {
    console.log('Setting up home button');
    const homeButton = document.getElementById('homeButton');
    console.log('Home Button:', homeButton);
    if (homeButton) {
        homeButton.addEventListener('click', backToHome);
    } else {
        console.log('Home button not found');
    }
}

if (document.readyState === 'loading') {  // Loading hasn't finished yet
    document.addEventListener('DOMContentLoaded', setupHomeButton);
} else {  // `DOMContentLoaded` has already fired
    setupHomeButton();
}

document.getElementById('cameraButton').addEventListener('click', function() {
    switchCamera();
});

document.addEventListener('DOMContentLoaded', function() {
    const cameraButton = document.getElementById('cameraButton');
    if (cameraButton) {
        cameraButton.addEventListener('click', switchCamera);
        console.log('Event listener attached to switch view button.');
    } else {
        console.log('Camera button not found.');
    }
});

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, currentCamera);
    const deltaTime = clock.getDelta();
    updatePaddlePosition(deltaTime);
    updateBallPosition(); // Keep the ball with the paddle until launch
    updatePhysics();
    if (gameMode) {
        updateAI(deltaTime); // Update AI control if AI is enabled
    }
    updatePhysics(); // Update physics and render the scene
    renderer.render(scene, currentCamera);
}
    animate();
    
}

document.getElementById('muteButton').addEventListener('click', function() {
    var bgMusic = document.getElementById('bgMusic');
    bgMusic.muted = !bgMusic.muted; // Toggle the muted state
    this.textContent = bgMusic.muted ? 'Unmute Music' : 'Mute/Unmute Music'; // Update button text
});
document.addEventListener('DOMContentLoaded', function() {
    const startOnePlayerButton = document.getElementById('startOnePlayer');
    const startTwoPlayerButton = document.getElementById('startTwoPlayer');

    if (startOnePlayerButton && startTwoPlayerButton) {
        startOnePlayerButton.addEventListener('click', function() {
            console.log("1 Player Game button clicked");
            startGame(true);
        });

        startTwoPlayerButton.addEventListener('click', function() {
            console.log("2 Player Game button clicked");
            startGame(false);
        });
    } else {
        console.log("Buttons not found, check HTML IDs and button placement.");
    }
});


function startGame(isOnePlayer) {
    console.log("Game mode: " + (isOnePlayer ? "1 Player" : "2 Player"));
    document.getElementById('startMenu').style.display = 'none';
    init();
    gameMode = isOnePlayer;  // Properly using the declared variable
    console.log("Game mode set to: " + (gameMode ? "One Player" : "Two Player"));
}



