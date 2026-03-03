import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

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
  watch_date?: string;
}

export default function Watched() {
  const { token } = useAuth();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [filteredMovies, setFilteredMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'rating'>('date');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');

  useEffect(() => {
    fetchMovies();
  }, []);

  useEffect(() => {
    filterAndSortMovies();
  }, [searchQuery, movies, sortBy, filterType]);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const watchedMovies = response.data.filter((m: Movie) => m.watched);
      setMovies(watchedMovies);
      setFilteredMovies(watchedMovies);
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

  const filterAndSortMovies = () => {
    let filtered = movies;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((movie) =>
        movie.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((movie) => movie.media_type === filterType);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.watch_date || 0).getTime() - new Date(a.watch_date || 0).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'rating') {
        return (b.personal_rating || 0) - (a.personal_rating || 0);
      }
      return 0;
    });

    setFilteredMovies(sorted);
  };

  const moveToWatchlist = async (movieId: string) => {
    try {
      await axios.put(
        `${API_URL}/api/movies/${movieId}`,
        { watched: false, personal_rating: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
        {item.personal_rating && (
          <View style={styles.personalRatingContainer}>
            <Text style={styles.personalRatingLabel}>Your Rating: </Text>
            <Text style={styles.personalRating}>{item.personal_rating}/10</Text>
          </View>
        )}
        {item.watch_date && (
          <Text style={styles.watchDate}>
            Watched: {new Date(item.watch_date).toLocaleDateString()}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert('Move to Watchlist', 'Move back to watchlist?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Move', onPress: () => moveToWatchlist(item.id) },
            ]);
          }}
        >
          <Ionicons name="arrow-undo" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert('Delete', 'Remove this movie?', [
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
        <Text style={styles.headerTitle}>Watched</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search watched movies..."
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
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.filterGroup}>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'movie' && styles.filterButtonActive]}
            onPress={() => setFilterType('movie')}
          >
            <Text style={[styles.filterText, filterType === 'movie' && styles.filterTextActive]}>
              Movies
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'tv' && styles.filterButtonActive]}
            onPress={() => setFilterType('tv')}
          >
            <Text style={[styles.filterText, filterType === 'tv' && styles.filterTextActive]}>
              Series
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sortGroup}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'date' && styles.sortButtonActive]}
            onPress={() => setSortBy('date')}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={sortBy === 'date' ? '#E50914' : '#666'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'title' && styles.sortButtonActive]}
            onPress={() => setSortBy('title')}
          >
            <Ionicons
              name="text"
              size={16}
              color={sortBy === 'title' ? '#E50914' : '#666'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, sortBy === 'rating' && styles.sortButtonActive]}
            onPress={() => setSortBy('rating')}
          >
            <Ionicons
              name="star"
              size={16}
              color={sortBy === 'rating' ? '#E50914' : '#666'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {filteredMovies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={80} color="#444" />
          <Text style={styles.emptyText}>
            {searchQuery || filterType !== 'all' ? 'No movies found' : 'No watched movies yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your filters'
              : 'Mark movies as watched to see them here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMovies}
          renderItem={renderMovie}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#E50914']} />
          }
        />
      )}
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
    padding: 16,
  },
  searchBar: {
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
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#333',
  },
  filterButtonActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  filterText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    color: '#999',
    fontSize: 14,
  },
  sortButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  sortButtonActive: {
    borderColor: '#E50914',
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
    marginBottom: 4,
  },
  personalRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  personalRatingLabel: {
    fontSize: 12,
    color: '#999',
  },
  personalRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E50914',
  },
  watchDate: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
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
    textAlign: 'center',
  },
});
