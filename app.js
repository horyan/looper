// Global variables
let mediaRecorder;
let audioChunks = [];
let tracks = [];
let isRecording = false;

// DOM Elements
const allowMicrophoneButton = document.getElementById('allow-microphone');
const startRecordingButton = document.getElementById('start-recording');
const stopRecordingButton = document.getElementById('stop-recording');
const tracksList = document.getElementById('tracks-list');

// Request microphone access
allowMicrophoneButton.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        allowMicrophoneButton.disabled = true;
        startRecordingButton.disabled = false;
        
        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        
        // Set up MediaRecorder event handlers
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const trackId = Date.now();
            
            // Add track to tracks array
            tracks.push({
                id: trackId,
                url: audioUrl,
                name: `Track ${tracks.length + 1}`
            });
            
            // Create track element and get the audio element
            const audioElement = createTrackElement(trackId, audioUrl);
            
            // Reset for next recording
            audioChunks = [];
            isRecording = false;
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;

            // Start playing the track
            if (audioElement) {
                audioElement.play().catch(error => console.error('Autoplay failed:', error));
            }
        };
    } catch (error) {
        console.error('Error accessing microphone:', error);
    }
});

// Start recording
startRecordingButton.addEventListener('click', () => {
    if (mediaRecorder && !isRecording) {
        audioChunks = [];
        mediaRecorder.start();
        isRecording = true;
        startRecordingButton.disabled = true;
        stopRecordingButton.disabled = false;
    }
});

// Stop recording
stopRecordingButton.addEventListener('click', () => {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
    }
});

// Create track element with playback controls
function createTrackElement(trackId, audioUrl) {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';
    trackDiv.id = `track-${trackId}`;
    
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = audioUrl;
    audio.loop = false; // We'll handle looping manually
    
    // Create editable track name
    const trackNameDiv = document.createElement('div');
    const trackNameInput = document.createElement('input');
    trackNameInput.type = 'text';
    trackNameInput.value = `Track ${tracks.length}`;
    trackNameInput.className = 'track-name';
    
    // Update track name in tracks array when changed
    trackNameInput.addEventListener('change', () => {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            track.name = trackNameInput.value;
        }
    });
    
    trackNameDiv.appendChild(trackNameInput);
    
    // Create start point control
    const startPointDiv = document.createElement('div');
    const startPointLabel = document.createElement('label');
    startPointLabel.textContent = 'Start (seconds): ';
    const startPointInput = document.createElement('input');
    startPointInput.type = 'number';
    startPointInput.min = '0';
    startPointInput.step = '0.1';
    startPointInput.value = '0';
    startPointDiv.appendChild(startPointLabel);
    startPointDiv.appendChild(startPointInput);

    // Create end point control
    const endPointDiv = document.createElement('div');
    const endPointLabel = document.createElement('label');
    endPointLabel.textContent = 'End (seconds): ';
    const endPointInput = document.createElement('input');
    endPointInput.type = 'number';
    endPointInput.min = '0';
    endPointInput.step = '0.1';
    endPointInput.value = '0';
    endPointDiv.appendChild(endPointLabel);
    endPointDiv.appendChild(endPointInput);

    // Update end point max value when audio is loaded
    audio.addEventListener('loadedmetadata', () => {
        endPointInput.max = audio.duration;
        endPointInput.value = audio.duration.toFixed(1);
        startPointInput.max = audio.duration;
    });

    // Validate start point
    startPointInput.addEventListener('change', () => {
        const startValue = parseFloat(startPointInput.value);
        const endValue = parseFloat(endPointInput.value);
        
        if (startValue > endValue) {
            startPointInput.value = endValue;
        }
        if (startValue < 0) {
            startPointInput.value = 0;
        }
        if (startValue > audio.duration) {
            startPointInput.value = audio.duration;
        }
    });

    // Validate end point
    endPointInput.addEventListener('change', () => {
        const startValue = parseFloat(startPointInput.value);
        const endValue = parseFloat(endPointInput.value);
        
        if (endValue < startValue) {
            endPointInput.value = startValue;
        }
        if (endValue < 0) {
            endPointInput.value = 0;
        }
        if (endValue > audio.duration) {
            endPointInput.value = audio.duration;
        }
    });

    // Create loop toggle button
    const loopButton = document.createElement('button');
    let isLooping = true; // Set looping to true by default
    loopButton.textContent = 'Loop: ON';

    loopButton.addEventListener('click', () => {
        isLooping = !isLooping;
        loopButton.textContent = isLooping ? 'Loop: ON' : 'Loop: OFF';
        if (isLooping && audio.paused) {
            audio.currentTime = parseFloat(startPointInput.value);
            audio.play().catch(error => console.error('Playback failed:', error));
        }
    });

    // Handle playback with start/end points
    audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        const startTime = parseFloat(startPointInput.value);
        const endTime = parseFloat(endPointInput.value);

        if (currentTime >= endTime) {
            if (isLooping) {
                audio.currentTime = startTime;
                audio.play().catch(error => console.error('Playback failed:', error));
            } else {
                audio.pause();
                audio.currentTime = startTime;
            }
        }
    });

    // Add apply button to update playback points
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply Points';
    applyButton.addEventListener('click', () => {
        audio.currentTime = parseFloat(startPointInput.value);
    });

    trackDiv.appendChild(trackNameDiv);
    trackDiv.appendChild(audio);
    trackDiv.appendChild(startPointDiv);
    trackDiv.appendChild(endPointDiv);
    trackDiv.appendChild(loopButton);
    trackDiv.appendChild(applyButton);
    tracksList.appendChild(trackDiv);

    return audio; // Return the audio element for autoplay
} 