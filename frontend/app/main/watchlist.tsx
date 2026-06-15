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
import CineviaxLogo from '../../components/CineviaxLogo';
import { useRouter } from 'expo-router';

import { API_URL } from '../../utils/api';
import { cacheWatchlist, getCachedWatchlist } from '../../utils/cacheStorage';

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
  added_at?: string;
}

export default function Watchlist() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
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
  const [isAdding, setIsAdding] = useState(false);

  // Sorting and Filtering states
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'rating'>('date');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');

  // TMDB search pagination states
  const [searchPage, setSearchPage] = useState<number>(1);
  const [totalSearchPages, setTotalSearchPages] = useState<number>(1);

  // Load offline cache on mount
  useEffect(() => {
    loadCachedData();
    fetchMovies();
  }, []);

  const loadCachedData = async () => {
    try {
      const cached = await getCachedWatchlist();
      if (cached && cached.length > 0) {
        setAllMovies(cached);
        const watchlistMovies = cached
          .filter((m: Movie) => !m.watched)
          .reduce((map: Map<number, Movie>, movie: Movie) => {
            if (!map.has(movie.tmdb_id)) {
              map.set(movie.tmdb_id, movie);
            }
            return map;
          }, new Map<number, Movie>());
        const uniqueWatchlist = Array.from(watchlistMovies.values());
        setMovies(uniqueWatchlist);
        setFilteredMovies(uniqueWatchlist);
        setLoading(false);
      }
    } catch (e) {
      console.error('Error loading cached data:', e);
    }
  };

  useEffect(() => {
    filterAndSortMovies();
  }, [searchQuery, movies, sortBy, filterType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchTMDB(searchQuery, 1);
      } else {
        setTmdbResults([]);
        setSearchPage(1);
        setTotalSearchPages(1);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const combinedSearchResults = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const list: any[] = [];

    // 1. Add watchlist matches if any
    const watchlistMatches = filteredMovies;
    if (watchlistMatches.length > 0) {
      list.push({ isHeader: true, title: 'In your Watchlist', id: 'header-watchlist' });
      watchlistMatches.forEach((m) => {
        list.push({ isHeader: false, isWatchlist: true, item: m, id: `wl-${m.id}` });
      });
    }

    // 2. Add TMDB results
    if (tmdbResults.length > 0) {
      list.push({ isHeader: true, title: 'From TMDB', id: 'header-tmdb' });
      tmdbResults.forEach((item) => {
        list.push({ isHeader: false, isWatchlist: false, item, id: `tmdb-${item.tmdb_id}` });
      });

      // 3. Add pagination trigger
      if (searchPage < totalSearchPages) {
        list.push({ isLoadMore: true, id: 'load-more-btn' });
      }
    }

    return list;
  }, [searchQuery, filteredMovies, tmdbResults, searchPage, totalSearchPages]);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const all = response.data || [];
      setAllMovies(all);
      await cacheWatchlist(all); // Save to local storage cache

      const watchlistMovies = all
        .filter((m: Movie) => !m.watched)
        .reduce((map: Map<number, Movie>, movie: Movie) => {
          if (!map.has(movie.tmdb_id)) {
            map.set(movie.tmdb_id, movie);
          }
          return map;
        }, new Map<number, Movie>());
      const uniqueWatchlist = Array.from(watchlistMovies.values());
      setMovies(uniqueWatchlist);
    } catch (error: any) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      console.error('Error fetching movies:', error);
      // Only show alert if we don't have any cached data displayed
      if (movies.length === 0) {
        Alert.alert('Error', 'Failed to load movies');
      }
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
        return new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'rating') {
        return (b.tmdb_rating || 0) - (a.tmdb_rating || 0);
      }
      return 0;
    });

    setFilteredMovies(sorted);
  };

  const searchTMDB = async (query: string, page: number = 1) => {
    if (!query.trim()) {
      setTmdbResults([]);
      setSearchPage(1);
      setTotalSearchPages(1);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/search/tmdb`, {
        params: { query, page },
        headers: { Authorization: `Bearer ${token}` },
      });
      const results = response.data.results || [];
      if (page === 1) {
        setTmdbResults(results);
      } else {
        setTmdbResults((prev) => [...prev, ...results]);
      }
      setSearchPage(response.data.page || 1);
      setTotalSearchPages(response.data.total_pages || 1);
    } catch (error: any) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      console.error('Error searching TMDB:', error);
      Alert.alert('Error', 'Failed to search movies');
    } finally {
      setSearchLoading(false);
    }
  };

  const loadMoreTMDB = async () => {
    if (searchLoading || searchPage >= totalSearchPages) return;
    await searchTMDB(searchQuery, searchPage + 1);
  };

  const handleWatchlistSearchSubmit = async () => {
    await searchTMDB(searchQuery, 1);
  };

  const addMovie = async (movie: any) => {
    if (isAdding) return;

    const existingMovie = allMovies.find((m) => m.tmdb_id === movie.tmdb_id);
    if (existingMovie) {
      const listType = existingMovie.watched ? 'watched list' : 'watchlist';
      Alert.alert('Already exists', `This movie is already in your ${listType}.`);
      return;
    }

    setIsAdding(true);
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
      if (await handleUnauthorizedError(error)) {
        return;
      }
      const detail = error.response?.data?.detail;
      if (detail === 'Movie already in your list') {
        const listType = existingMovie?.watched ? 'watched list' : 'watchlist';
        Alert.alert('Already exists', `This movie is already in your ${listType}.`);
      } else {
        Alert.alert('Error', detail || 'Failed to add movie');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const markAsWatched = (movie: Movie) => {
    setSelectedMovie(movie);
    setSelectedRating(0);
    setShowRatingModal(true);
  };

  const confirmMarkAsWatched = async () => {
    if (!selectedMovie) return;

    const originalMovies = [...movies];
    const originalAllMovies = [...allMovies];
    const targetId = selectedMovie.id;

    // Optimistic update
    setMovies((prev) => prev.filter((m) => m.id !== targetId));
    setAllMovies((prev) =>
      prev.map((m) =>
        m.id === targetId
          ? {
              ...m,
              watched: true,
              personal_rating: selectedRating > 0 ? selectedRating : undefined,
            }
          : m
      )
    );
    setShowRatingModal(false);
    setSelectedMovie(null);
    setSelectedRating(0);

    try {
      await axios.put(
        `${API_URL}/api/movies/${targetId}`,
        {
          watched: true,
          personal_rating: selectedRating > 0 ? selectedRating : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchMovies();
    } catch (error: any) {
      // Revert on error
      setMovies(originalMovies);
      setAllMovies(originalAllMovies);
      if (await handleUnauthorizedError(error)) {
        return;
      }
      console.error('Error updating movie:', error);
      Alert.alert('Error', 'Failed to update movie');
    }
  };

  const deleteMovie = async (movieId: string) => {
    const originalMovies = [...movies];
    const originalAllMovies = [...allMovies];

    // Optimistic update
    setMovies((prev) => prev.filter((m) => m.id !== movieId));
    setAllMovies((prev) => prev.filter((m) => m.id !== movieId));

    try {
      await axios.delete(`${API_URL}/api/movies/${movieId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMovies();
    } catch (error: any) {
      setMovies(originalMovies);
      setAllMovies(originalAllMovies);
      if (await handleUnauthorizedError(error)) {
        return;
      }
      console.error('Error deleting movie:', error);
      Alert.alert('Error', 'Failed to delete movie');
    }
  };

  const handleUnauthorizedError = async (error: any) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await logout();
      router.replace('/auth/login');
      return true;
    }
    return false;
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

  const renderCombinedItem = ({ item }: { item: any }) => {
    if (item.isHeader) {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>{item.title}</Text>
          {item.title === 'From TMDB' && searchLoading && (
            <ActivityIndicator size="small" color="#E50914" style={{ marginLeft: 8 }} />
          )}
        </View>
      );
    }

    if (item.isWatchlist) {
      return renderMovie({ item: item.item });
    }

    if (item.isLoadMore) {
      return (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={loadMoreTMDB}
          disabled={searchLoading}
        >
          {searchLoading ? (
            <ActivityIndicator size="small" color="#E50914" />
          ) : (
            <Text style={styles.loadMoreText}>Load More Results</Text>
          )}
        </TouchableOpacity>
      );
    }

    const tmdbItem = item.item;
    const existingMovie = allMovies.find((m) => m.tmdb_id === tmdbItem.tmdb_id);
    const alreadyAdded = !!existingMovie;
    const isWatched = existingMovie?.watched;

    return (
      <TouchableOpacity
        style={styles.searchResultCard}
        onPress={() => (alreadyAdded ? null : addMovie(tmdbItem))}
        disabled={alreadyAdded || isAdding}
      >
        {tmdbItem.poster_path ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w200${tmdbItem.poster_path}` }}
            style={styles.searchResultPoster}
          />
        ) : (
          <View style={styles.searchResultPosterPlaceholder}>
            <Ionicons name="film-outline" size={30} color="#666" />
          </View>
        )}
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultTitle} numberOfLines={2}>
            {tmdbItem.title}
          </Text>
          <Text style={styles.searchResultMeta}>
            {tmdbItem.media_type === 'tv' ? 'Series' : 'Movie'} • {tmdbItem.year}
          </Text>
          {tmdbItem.tmdb_rating > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{tmdbItem.tmdb_rating.toFixed(1)}</Text>
            </View>
          )}
          {tmdbItem.genres && tmdbItem.genres.length > 0 && (
            <Text style={styles.searchResultGenres} numberOfLines={1}>
              {tmdbItem.genres.join(', ')}
            </Text>
          )}
          {alreadyAdded && (
            <Text style={styles.alreadyInWatchlistText}>
              Already in {isWatched ? 'watched list' : 'watchlist'}
            </Text>
          )}
        </View>
        {alreadyAdded ? (
          <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
        ) : (
          <Ionicons name="add-circle" size={32} color="#E50914" />
        )}
      </TouchableOpacity>
    );
  };

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
        <View style={styles.headerBrand}>
          <CineviaxLogo size={40} />
          <Text style={styles.headerTitle}>Watchlist</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search watchlist or TMDB..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleWatchlistSearchSubmit}
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

      {!searchQuery.trim() && (
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
      )}

      {searchQuery.trim() ? (
        combinedSearchResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={80} color="#444" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              We couldn't find any matches in your watchlist or TMDB.
            </Text>
          </View>
        ) : (
          <FlatList
            data={combinedSearchResults}
            renderItem={renderCombinedItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : movies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={80} color="#444" />
          <Text style={styles.emptyText}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtext}>Add movies to get started!</Text>
        </View>
      ) : filteredMovies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={80} color="#444" />
          <Text style={styles.emptyText}>No watchlist matches</Text>
          <Text style={styles.emptySubtext}>Try a different search query</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMovies}
          renderItem={renderMovie}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#E50914']}
            />
          }
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
              onSubmitEditing={() => searchTMDB(tmdbSearchQuery)}
            />
            <TouchableOpacity onPress={() => searchTMDB(tmdbSearchQuery)} disabled={searchLoading}>
              {searchLoading ? (
                <ActivityIndicator size="small" color="#E50914" />
              ) : (
                <Ionicons name="arrow-forward" size={20} color="#E50914" />
              )}
            </TouchableOpacity>
          </View>

          <FlatList
            data={tmdbResults}
            renderItem={({ item }) => {
              const existingMovie = allMovies.find((m) => m.tmdb_id === item.tmdb_id);
              const alreadyAdded = !!existingMovie;
              const isWatched = existingMovie?.watched;
              return (
                <TouchableOpacity
                  style={styles.searchResultCard}
                  onPress={() => (alreadyAdded ? null : addMovie(item))}
                  disabled={alreadyAdded || isAdding}
                >
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
                    {item.genres && item.genres.length > 0 && (
                      <Text style={styles.searchResultGenres} numberOfLines={1}>
                        {item.genres.join(', ')}
                      </Text>
                    )}
                    {alreadyAdded && (
                      <Text style={styles.alreadyInWatchlistText}>
                        Already in {isWatched ? 'watched list' : 'watchlist'}
                      </Text>
                    )}
                  </View>
                  {alreadyAdded ? (
                    <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                  ) : (
                    <Ionicons name="add-circle" size={32} color="#E50914" />
                  )}
                </TouchableOpacity>
              );
            }}
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
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E50914',
    marginLeft: 12,
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
  alreadyInWatchlistText: {
    marginTop: 4,
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  sectionHeader: {
    paddingVertical: 12,
    backgroundColor: '#141414',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  loadMoreButton: {
    paddingVertical: 14,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  loadMoreText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});