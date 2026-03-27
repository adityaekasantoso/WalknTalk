import { useState, useEffect, useRef } from "react";
import {
  quickAudioCheck,
  optimizeAudioSettings,
  applyAudioOutputDevice,
} from "@/utils/audio-diagnostics";

const useMediaStream = () => {
  const [state, setState] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [error, setError] = useState(null);

  const [permissions, setPermissions] = useState({
    audio: false,
  });

  const [audioDevices, setAudioDevices] = useState({
    inputs: [],
    outputs: [],
  });

  const [selectedAudioInput, setSelectedAudioInput] = useState("default");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("default");

  const isStreamSet = useRef(false);

  // ======================================
  // GET AUDIO DEVICES
  // ======================================
  const updateAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const inputs = devices.filter((device) => device.kind === "audioinput");
      const outputs = devices.filter((device) => device.kind === "audiooutput");

      setAudioDevices({ inputs, outputs });

      console.log("📱 Audio devices updated:", {
        inputs: inputs.length,
        outputs: outputs.length,
      });
    } catch (error) {
      console.error("❌ Failed to enumerate devices:", error);
    }
  };

  // ======================================
  // SWITCH AUDIO INPUT (MIC)
  // ======================================
  const switchAudioInput = async (deviceId) => {
    if (!state) return false;

    try {
      const audioConstraints = optimizeAudioSettings({
        deviceId: { exact: deviceId },
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      const oldAudioTrack = state.getAudioTracks()[0];

      if (oldAudioTrack) {
        state.removeTrack(oldAudioTrack);
        oldAudioTrack.stop();
      }

      const newAudioTrack = newStream.getAudioTracks()[0];

      if (newAudioTrack) {
        state.addTrack(newAudioTrack);
        setSelectedAudioInput(deviceId);
        setIsAudioEnabled(newAudioTrack.enabled);
      }

      console.log("🎤 Switched to audio input:", deviceId);
      return true;
    } catch (error) {
      console.error("❌ Failed to switch audio input:", error);
      setError(error.message);
      return false;
    }
  };

  // ======================================
  // SWITCH AUDIO OUTPUT (SPEAKER)
  // ======================================
  const switchAudioOutput = async (deviceId) => {
    try {
      setSelectedAudioOutput(deviceId);

      const results = await applyAudioOutputDevice(deviceId);

      console.log("🔊 Audio output device set to:", deviceId);

      return true;
    } catch (error) {
      console.error("❌ Failed to switch audio output:", error);
      return false;
    }
  };

  // ======================================
  // LISTEN DEVICE CHANGE
  // ======================================
  useEffect(() => {
    updateAudioDevices();

    const handleDeviceChange = () => {
      console.log("📱 Audio devices changed");
      updateAudioDevices();
    };

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

      return () => {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );
      };
    }
  }, []);

  // ======================================
  // INIT AUDIO STREAM (NO VIDEO)
  // ======================================
  useEffect(() => {
    if (isStreamSet.current) return;
    isStreamSet.current = true;

    (async function initStream() {
      try {
        if (process.env.NODE_ENV === "development") {
          console.log("🔍 Running audio diagnostics...");
          await quickAudioCheck();
        }

        const audioConstraints = optimizeAudioSettings();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        console.log("🎤 Audio stream created");
        console.log("Audio tracks:", stream.getAudioTracks().length);

        setState(stream);
        setPermissions({ audio: true });

        const audioTracks = stream.getAudioTracks();

        if (audioTracks.length > 0) {
          setIsAudioEnabled(audioTracks[0].enabled);
        }
      } catch (e) {
        console.error("❌ Error getting audio stream:", e);
        setError(e.message);
      }
    })();
  }, []);

  // ======================================
  // TOGGLE AUDIO (MIC ON/OFF)
  // ======================================
  const toggleAudio = () => {
    if (!state) return false;

    const audioTracks = state.getAudioTracks();

    if (audioTracks.length === 0) {
      console.warn("No audio tracks available");
      return false;
    }

    const currentState = audioTracks[0].enabled;
    const newState = !currentState;

    audioTracks[0].enabled = newState;
    setIsAudioEnabled(newState);

    console.log("🎤 Microphone:", newState ? "ON" : "OFF");

    return newState;
  };

  return {
    stream: state,
    isAudioEnabled,
    toggleAudio,
    error,
    permissions,
    audioDevices,
    selectedAudioInput,
    selectedAudioOutput,
    switchAudioInput,
    switchAudioOutput,
    updateAudioDevices,
  };
};

export default useMediaStream;