import * as THREE from 'https://unpkg.com/three/build/three.module.js';
//import CANNON from 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';

function init() {
    const clock = new THREE.Clock();
    let scorePlayer1 = 0;
    let scorePlayer2 = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 1, 2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    world.gravity.set(0, 0, 0);
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

    // Handle
    const handleGeometry = new THREE.CylinderGeometry(handleDiameter/2, handleDiameter/2, handleLength, 32);
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -handleLength / 2 - rubberThickness / 2;

    // Group for paddle
    const paddle1 = new THREE.Group();
    paddle1.add(rubber);
    paddle1.add(handle);
    paddle1.position.set(-1, 0, 0);

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
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
    directionalLight.position.set(1, 1, 1);
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

    // Add net to scene
    scene.add(net);
}, undefined, function(error) {
    console.error("Error loading the texture:", error);
});

    // Define materials and contact materials
    const bouncyMaterial = new CANNON.Material("bouncyMaterial");
    const tableMaterialCannon = new CANNON.Material("tableMaterial");
    const bouncyContactMaterial = new CANNON.ContactMaterial(bouncyMaterial, bouncyMaterial, {
        restitution: 2,
        friction: 0.0
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
    const ballSpeed = 2; // Speed at which the ball should move
    const ballRadius = 0.02;
    const ballShape = new CANNON.Sphere(ballRadius);
    const ballBody = new CANNON.Body({ mass: 0.1, shape: ballShape });
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    initialBallPosition = new THREE.Vector3(paddle2.position.x, paddle2.position.y + handleLength + ballRadius, paddle2.position.z);
ball.position.set(initialBallPosition.x, initialBallPosition.y, initialBallPosition.z);

    scene.add(ball);
    ballBody.addEventListener("collide", function(e) {
        console.log("Ball collided with", e.body);
    
        const velocityLength = ballBody.velocity.length();
    if (velocityLength !== 0) {
        ballBody.velocity.normalize(); // Normalize to get direction
        ballBody.velocity.scale(ballSpeed, ballBody.velocity); // Scale to desired speed
    }
    });

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



function checkBallOutOfBounds() {
    // Check if the ball falls off the ends of the table where the paddles are located
    if (ballBody.position.x > 2) {
        scorePlayer1++;
        // Ball went out on the side of paddle2
        resetBallAndPaddles(paddle1); // Reset to the opposite side, which is paddle1
    } else if (ballBody.position.x < -2) {
        // Ball went out on the side of paddle1
        scorePlayer2++;
        resetBallAndPaddles(paddle2); // Reset to the opposite side, which is paddle2
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
    if (scorePlayer1 >= 10 || scorePlayer2 >= 10) {
        let winnerMessage = scorePlayer1 >= 10 ? "Player1 Wins!" : "Player2 Wins!";
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
    ballBody.position.set(paddle.position.x - Math.sign(paddle.position.x) * 0.5, paddle.position.y + handleLength + ballRadius, paddle.position.z);
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
document.addEventListener('DOMContentLoaded', () => {
    const homeButton = document.getElementById('homeButton');
    if (homeButton) {
        homeButton.addEventListener('click', backToHome);
    } else {
        console.error('Back to Home button not found');
    }
});







function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    updatePaddlePosition(deltaTime);
    updateBallPosition(); // Keep the ball with the paddle until launch
    updatePhysics();
    renderer.render(scene, camera);
}

    animate();
}

document.getElementById('startButton').addEventListener('click', function() {
    document.getElementById('startMenu').style.display = 'none';
    init(); // Start game initialization
});

document.getElementById('muteButton').addEventListener('click', function() {
    var bgMusic = document.getElementById('bgMusic');
    bgMusic.muted = !bgMusic.muted; // Toggle the muted state
    this.textContent = bgMusic.muted ? 'Unmute Music' : 'Mute/Unmute Music'; // Update button text
});




