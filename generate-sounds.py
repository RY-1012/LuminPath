import numpy as np
import wave
import os

# Create sounds directory
os.makedirs('sounds', exist_ok=True)

def create_sound(filename, frequency=440, duration=0.5, volume=0.5):
    # Generate sine wave
    sample_rate = 44100
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # Handle multiple frequencies for chords
    if isinstance(frequency, list):
        # Create chord by mixing multiple frequencies
        wave_data = np.zeros_like(t)
        for freq in frequency:
            wave_data += np.sin(2 * np.pi * freq * t)
        wave_data = wave_data / len(frequency)  # Normalize
    else:
        # Single frequency
        wave_data = np.sin(2 * np.pi * frequency * t)
    
    # Convert to 16-bit PCM
    wave_data = (volume * wave_data * 32767).astype(np.int16)
    
    # Save as WAV
    with wave.open(f'sounds/{filename}', 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 2 bytes per sample
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(wave_data.tobytes())
    
    print(f'Created: sounds/{filename}')

# Generate different sounds
create_sound('paint.wav', frequency=800, duration=0.1, volume=0.3)
create_sound('waypoint.wav', frequency=1200, duration=0.2, volume=0.4)
create_sound('save.wav', frequency=[523, 659, 784], duration=0.3, volume=0.5)  # Chord
create_sound('clear.wav', frequency=300, duration=0.2, volume=0.3)

print("\n✅ All sounds generated successfully!")
print("Location: sounds/")
print("Files: paint.wav, waypoint.wav, save.wav, clear.wav")