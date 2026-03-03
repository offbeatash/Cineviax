import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Movie {
  id: string;
  tmdb_id: number;
  title: string;
  poster_base64?: string;
  tmdb_rating?: number;
  genres: string[];
  year?: string;
  media_type: string;
  watched: boolean;
  personal_rating?: number;
}

export default function Watchlist() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [filteredMovies, setFilteredMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedRating, setSelectedRating] = useState<number>(0);

  useEffect(() => {
    fetchMovies();
  }, []);

  useEffect(() => {
    filterMovies();
  }, [searchQuery, movies]);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const watchlistMovies = response.data.filter((m: Movie) => !m.watched);
      setMovies(watchlistMovies);
      setFilteredMovies(watchlistMovies);
    } catch (error) {
      console.error('Error fetching movies:', error);
      Alert.alert('Error', 'Failed to load movies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMovies();
  };

  const filterMovies = () => {
    if (!searchQuery) {
      setFilteredMovies(movies);
      return;
    }
    const filtered = movies.filter((movie) =>
      movie.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredMovies(filtered);
  };

  const searchTMDB = async () => {
    if (!tmdbSearchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/search/tmdb`, {
        params: { query: tmdbSearchQuery },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTmdbResults(response.data.results);
    } catch (error) {
      console.error('Error searching TMDB:', error);
      Alert.alert('Error', 'Failed to search movies');
    } finally {
      setSearchLoading(false);
    }
  };

  const addMovie = async (movie: any) => {
    try {
      await axios.post(
        `${API_URL}/api/movies`,
        {
          tmdb_id: movie.tmdb_id,
          title: movie.title,
          poster_path: movie.poster_path,
          tmdb_rating: movie.tmdb_rating,
          genres: movie.genres,
          year: movie.year,
          media_type: movie.media_type,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert('Success', 'Added to watchlist!');
      setShowSearchModal(false);
      setTmdbSearchQuery('');
      setTmdbResults([]);
      fetchMovies();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add movie');
    }
  };

  const markAsWatched = (movie: Movie) => {
    setSelectedMovie(movie);
    setSelectedRating(0);
    setShowRatingModal(true);
  };

  const confirmMarkAsWatched = async () => {
    if (!selectedMovie) return;

    try {
      await axios.put(
        `${API_URL}/api/movies/${selectedMovie.id}`,
        {
          watched: true,
          personal_rating: selectedRating > 0 ? selectedRating : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowRatingModal(false);
      setSelectedMovie(null);
      setSelectedRating(0);
      fetchMovies();
    } catch (error) {
      console.error('Error updating movie:', error);
      Alert.alert('Error', 'Failed to update movie');
    }
  };

  const deleteMovie = async (movieId: string) => {
    try {
      await axios.delete(`${API_URL}/api/movies/${movieId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMovies();
    } catch (error) {
      console.error('Error deleting movie:', error);
      Alert.alert('Error', 'Failed to delete movie');
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const renderMovie = ({ item }: { item: Movie }) => (
    <View style={styles.movieCard}>
      {item.poster_base64 ? (
        <Image source={{ uri: item.poster_base64 }} style={styles.poster} />
      ) : (
        <View style={styles.posterPlaceholder}>
          <Ionicons name="film-outline" size={40} color="#666" />
        </View>
      )}
      <View style={styles.movieInfo}>
        <Text style={styles.movieTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.movieMeta}>
          <Text style={styles.movieType}>
            {item.media_type === 'tv' ? 'Series' : 'Movie'} • {item.year}
          </Text>
          {item.tmdb_rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{item.tmdb_rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        {item.genres.length > 0 && (
          <Text style={styles.genres} numberOfLines={1}>
            {item.genres.join(', ')}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => markAsWatched(item)}
        >
          <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert('Delete', 'Remove from watchlist?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMovie(item.id) },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={24} color="#E50914" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Watchlist</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#E50914" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your watchlist..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowSearchModal(true)}>
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {filteredMovies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={80} color="#444" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No movies found' : 'Your watchlist is empty'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 'Try a different search' : 'Add movies to get started!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMovies}
          renderItem={renderMovie}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#E50914']} />}
        />
      )}

      {/* TMDB Search Modal */}
      <Modal visible={showSearchModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Movies & Series</Text>
            <TouchableOpacity onPress={() => setShowSearchModal(false)}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchBar}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search TMDB..."
              placeholderTextColor="#666"
              value={tmdbSearchQuery}
              onChangeText={setTmdbSearchQuery}
              onSubmitEditing={searchTMDB}
            />
            <TouchableOpacity onPress={searchTMDB} disabled={searchLoading}>
              {searchLoading ? (
                <ActivityIndicator size="small" color="#E50914" />
              ) : (
                <Ionicons name="arrow-forward" size={20} color="#E50914" />
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={tmdbResults}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.searchResultCard} onPress={() => addMovie(item)}>
                {item.poster_path ? (
                  <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }}
                    style={styles.searchResultPoster}
                  />
                ) : (
                  <View style={styles.searchResultPosterPlaceholder}>
                    <Ionicons name="film-outline" size={30} color="#666" />
                  </View>
                )}
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.searchResultMeta}>
                    {item.media_type === 'tv' ? 'Series' : 'Movie'} • {item.year}
                  </Text>
                  {item.tmdb_rating > 0 && (
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.ratingText}>{item.tmdb_rating.toFixed(1)}</Text>
                    </View>
                  )}
                  {item.genres.length > 0 && (
                    <Text style={styles.searchResultGenres} numberOfLines={1}>
                      {item.genres.join(', ')}
                    </Text>
                  )}
                </View>
                <Ionicons name="add-circle" size={32} color="#E50914" />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.tmdb_id.toString()}
            contentContainerStyle={styles.searchResults}
            ListEmptyComponent={
              tmdbSearchQuery ? (
                <View style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={60} color="#444" />
                  <Text style={styles.emptySearchText}>No results found</Text>
                </View>
              ) : (
                <View style={styles.emptySearch}>
                  <Ionicons name="film-outline" size={60} color="#444" />
                  <Text style={styles.emptySearchText}>Search for movies and TV series</Text>
                </View>
              )
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Rating Modal */}
      <Modal visible={showRatingModal} animationType="fade" transparent={true}>
        <View style={styles.ratingModalOverlay}>
          <View style={styles.ratingModalContent}>
            <Text style={styles.ratingModalTitle}>Rate this movie</Text>
            <Text style={styles.ratingModalSubtitle}>{selectedMovie?.title}</Text>

            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={styles.ratingButton}
                  onPress={() => setSelectedRating(rating)}
                >
                  <Text
                    style={[
                      styles.ratingNumber,
                      selectedRating >= rating && styles.ratingNumberSelected,
                    ]}
                  >
                    {rating}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.ratingModalActions}>
              <TouchableOpacity
                style={[styles.ratingModalButton, styles.ratingModalButtonSecondary]}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.ratingModalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ratingModalButton, styles.ratingModalButtonPrimary]}
                onPress={confirmMarkAsWatched}
              >
                <Text style={styles.ratingModalButtonText}>Mark as Watched</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E50914',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#E50914',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  movieCard: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  poster: {
    width: 100,
    height: 150,
  },
  posterPlaceholder: {
    width: 100,
    height: 150,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  movieInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  movieMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  movieType: {
    fontSize: 12,
    color: '#999',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  genres: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#141414',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 12,
    margin: 16,
    height: 48,
    gap: 8,
  },
  searchResults: {
    padding: 16,
  },
  searchResultCard: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  searchResultPoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
  },
  searchResultPosterPlaceholder: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  searchResultMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  searchResultGenres: {
    fontSize: 12,
    color: '#666',
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ratingModalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  ratingModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  ratingModalSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingStars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  ratingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  ratingNumberSelected: {
    color: '#E50914',
  },
  ratingModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingModalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingModalButtonPrimary: {
    backgroundColor: '#E50914',
  },
  ratingModalButtonSecondary: {
    backgroundColor: '#444',
  },
  ratingModalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ratingModalButtonTextSecondary: {
    color: '#FFF',
    fontSize: 16,
  },
});