import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, Alert, ImageBackground, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getArtwork, toggleArtworkLike } from '../../database/artworks';
import { addMessage, getMessagesByArtwork, Message } from '../../database/messages';
import { useLanguage } from '../../utils/i18n/LanguageContext';
import { generateResponse } from '../../services/chat';
import { cacheTtsAudio, getCachedTtsUrl, getTtsCacheKey, getTtsStreamUrl } from '../../services/audio';
import { getCachedAudioUri, saveAudioToCache } from '../../utils/fileSystem';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';

export default function ArtworkDetail() {
  const { id, from } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [artwork, setArtwork] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [shouldRenderImage, setShouldRenderImage] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [localAudioUri, setLocalAudioUri] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayRef = useRef<string | null>(null);
  const isFocused = useIsFocused();
  const player = useAudioPlayer(audioSource ?? null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;
  const isStreamSource = !!streamUrl && audioSource === streamUrl;
  const isStreamLoading = isStreamSource && !status.isLoaded;
  const isAudioReady = !!audioSource && (!isStreamSource || status.isLoaded);
  const ttsVoice = 'alloy';

  
  useEffect(() => {
    // Configure audio for background playback
    const setupAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
          allowsRecording: false,
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: false,
        });
      } catch (error) {
        console.error('Error setting up audio mode:', error);
      }
    };
    setupAudio();
  }, []);

  useEffect(() => {
    if (isFocused) return;
    if (!status.isLoaded || !status.playing) return;

    try {
      player.pause();
    } catch (error) {
      console.warn('Error pausing audio:', error);
    }
  }, [isFocused, player, status.isLoaded, status.playing]);

  useEffect(() => {
    if (status.playing) return;
    const nextSource = localAudioUri ?? streamUrl;
    if (nextSource !== audioSource) {
      setAudioSource(nextSource ?? null);
    }
  }, [audioSource, localAudioUri, status.playing, streamUrl]);

  useEffect(() => {
    if (!streamUrl) return;
    if (audioSource !== streamUrl) return;
    if (!status.isLoaded || status.playing) return;
    if (autoPlayRef.current === streamUrl) return;

    autoPlayRef.current = streamUrl;
    try {
      player.play();
    } catch (error) {
      console.warn('Error auto-playing stream audio:', error);
    }
  }, [audioSource, player, status.isLoaded, status.playing, streamUrl]);

  useEffect(() => {
    const loadArtwork = async () => {
      setLocalAudioUri(null);
      setStreamUrl(null);
      setAudioSource(null);

      const artworkData = await getArtwork(id as string);
      if (artworkData) {
        if (artworkData?.image_uri) {
          try {
            await Image.prefetch(artworkData.image_uri);
            setShouldRenderImage(true);
          } catch (err) {
            console.warn("Prefetch failed:", err);
          }
        }
        setArtwork(artworkData);
        setIsLiked(artworkData.liked || false);
        const messages = await getMessagesByArtwork(artworkData.id);
        setMessages(messages);
        if (artworkData.description) {
          const cacheKey = getTtsCacheKey(artworkData.description, ttsVoice);

          const cachedLocalUri = await getCachedAudioUri(cacheKey);
          if (cachedLocalUri) {
            setLocalAudioUri(cachedLocalUri);
            setStreamUrl(null);
            return;
          }

          const cachedRemoteUrl = await getCachedTtsUrl(cacheKey);
          if (cachedRemoteUrl) {
            const savedUri = await saveAudioToCache(cachedRemoteUrl, cacheKey);
            setLocalAudioUri(savedUri);
            setStreamUrl(null);
            return;
          }

          const nextStreamUrl = getTtsStreamUrl(artworkData.description, ttsVoice);
          setStreamUrl(nextStreamUrl);

          // Kick off caching in the background for future plays.
          cacheTtsAudio(artworkData.description, ttsVoice, cacheKey)
            .then(async (result) => {
              if (!result.audio_url) return;
              const savedUri = await saveAudioToCache(result.audio_url, result.cache_key);
              setLocalAudioUri(savedUri);
            })
            .catch((error) => {
              console.warn('Error caching TTS audio:', error);
            });
        } else {
          setStreamUrl(null);
          setLocalAudioUri(null);
          setAudioSource(null);
        }
      }
    };
    loadArtwork();
  }, [id]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    try {
      const userMessage: Omit<Message, 'id' | 'type' | 'created_at'> = {
        artwork_id: artwork.id,
        role: 'user',
        text: inputText
      };

      await addMessage(userMessage);
      setMessages(prev => [...prev, { ...userMessage, id: `msg_${Date.now()}`, type: 'message', created_at: Date.now() }]);
      setInputText('');

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Get AI response
      const response = await generateResponse(
        artwork.title,
        artwork.artist,
        artwork.museum_name,
        inputText,
        messages.map(msg => ({
          role: msg.role,
          content: msg.text
        }))
      );
      
      const assistantMessage: Omit<Message, 'id' | 'type' | 'created_at'> = {
        artwork_id: artwork.id,
        role: 'assistant',
        text: response.text
      };

      await addMessage(assistantMessage);
      setMessages(prev => [...prev, { ...assistantMessage, id: `msg_${Date.now()}`, type: 'message', created_at: Date.now() }]);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error generating response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    try {
      if (!isAudioReady || !audioSource) return;

      if (status.playing) {
        player.pause();
        return;
      }

      const duration = status.duration || 0;
      if (duration > 0 && status.currentTime >= duration) {
        await player.seekTo(0);
      }

      player.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleLikeToggle = async () => {
    try {
      const updatedArtwork = await toggleArtworkLike(artwork.id);
      setArtwork(updatedArtwork);
      setIsLiked(updatedArtwork.liked || false);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  if (!artwork) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <>
      <ImageBackground
        source={artwork.image_uri ? { uri: artwork.image_uri } : undefined}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <BlurView intensity={40} style={{ flex: 1 }}>
          {/* Top Navigation */}
          <View style={styles.topNav}>
            <TouchableOpacity
              onPress={() => {
                if (from === 'loading') {
                  router.replace('/');
                } else {
                  router.back();
                }
              }}
            >
              <Ionicons
                name={from === 'loading' ? 'home-outline' : 'arrow-back'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <View style={styles.topNavRight}>
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={handleLikeToggle}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isLiked ? "#FF3B30" : "#FFFFFF"} 
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/camera')}>
                <Ionicons name="scan-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={[styles.scrollSection, { backgroundColor: 'transparent' }]}
              contentContainerStyle={{ paddingBottom: 40 }}
              ref={scrollViewRef}
            >
              {/* Artwork Image */}
              {artwork.image_uri && (
                <View style={styles.imageContainer}>
                  {shouldRenderImage ? (
                    <Image
                      source={{ uri: artwork.image_uri }}
                      style={styles.topImage}
                      resizeMode="cover"
                      onLoadStart={() => {
                        setIsImageLoaded(false);
                      }}
                      onLoadEnd={() => {
                        setIsImageLoaded(true);
                        setShouldRenderImage(true);
                      }}
                      onError={() => {
                        console.warn('Image failed to load.');
                        setIsImageLoaded(true);
                        setShouldRenderImage(false);
                      }}
                    />
                  ) : (
                    <View style={styles.imageLoadingContainer}>
                      <Text style={styles.imageLoadingText}>{t('loading')}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Title and Metadata Block */}
              <View style={[styles.metaBlock, {backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20}]}> 
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{artwork.title}</Text>
                  <View style={styles.artistRow}>
                    <Text style={styles.artistMeta} numberOfLines={1}>
                      {artwork.artist}
                    </Text>
                    <View style={styles.artistRight}>
                      {artwork.museum_logo_uri && (
                        <Image source={{ uri: artwork.museum_logo_uri }} style={styles.museumLogo} resizeMode="contain" />
                      )}
                      <TouchableOpacity
                        style={[
                          styles.titleAudioButton,
                          isAudioReady && styles.titleAudioButtonActive
                        ]}
                        onPress={() => {
                          if (!isAudioReady || !audioSource) return;
                          handlePlayPause();
                        }}
                        disabled={!isAudioReady}
                      >
                        {isStreamLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={isAudioReady ? "#FFFFFF" : "#666666"}
                          />
                        ) : (
                          <Ionicons
                            name={isPlaying ? "pause" : "play"}
                            size={24}
                            color={isAudioReady ? "#FFFFFF" : "#666666"}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.museumMeta}>{artwork.museum_name}</Text>
                  <Text style={styles.description}>{artwork.description}</Text>
                </View>
              </View>
              <View style={styles.messagesSectionAligned}>
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={
                      message.role === 'user'
                        ? styles.userBubbleRow
                        : styles.aiBubbleRow
                    }
                  >
                    <View
                      style={
                        message.role === 'user'
                          ? styles.userBubble
                          : styles.aiBubble
                      }
                    >
                      <Text style={styles.bubbleText}>{message.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
            {/* Input Section */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('askAboutArtwork')}
                placeholderTextColor="#666"
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
              >
                <Ionicons 
                  name="send" 
                  size={24} 
                  color={!inputText.trim() || isLoading ? "#666" : "#FFFFFF"} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topImage: {
    width: '100%',
    height: '100%',
  },
  imageContainer: {
    width: '85%',
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 20,
    marginTop: 120,
    marginBottom: 20,
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  imageLoadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  scrollSection: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    position: 'absolute',
    top: Platform.select({ ios: 48, android: 24, default: 32 }),
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -8,
  },
  artistMeta: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.9,
    flex: 1,
    marginRight: 12,
  },
  artistRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  museumMeta: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 0,
  },
  museumLogo: {
    width: 48,
    height: 48,
    marginLeft: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  actionButton: {
    marginRight: 20,
  },
  messagesSectionAligned: {
    width: '100%',
    paddingHorizontal: 0,
    marginTop: 16,
  },
  aiBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  userBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 18,
    marginLeft: 20,
    marginRight: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 14,
    maxWidth: '80%',
    width: 'auto',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(80, 90, 110, 0.7)',
    borderRadius: 18,
    marginRight: 20,
    marginLeft: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '80%',
    width: 'auto',
  },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  roleAssistant: {
    color: '#aaa',
    fontSize: 15,
    marginLeft: 4,
    marginRight: 0,
    alignSelf: 'flex-start',
  },
  roleUser: {
    color: '#fff', 
    fontSize: 15,
    marginRight: 4,
    marginLeft: 0,
    alignSelf: 'flex-end',
  },
  messageRole: {
    marginBottom: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 25,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: '#FFFFFF',
    marginRight: 10,
    marginTop: -14,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  metaBlock: {
    padding: 20,
    marginHorizontal: 20,
  },
  titleAudioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  titleAudioButtonActive: {
    backgroundColor: '#007AFF',
  },
  description: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    opacity: 0.9,
  },
}); 
