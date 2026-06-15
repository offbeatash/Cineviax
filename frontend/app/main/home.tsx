import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../utils/api';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

interface MovieCard {
  tmdb_id: number;
  title: string;
  poster_path?: string | null;
  tmdb_rating?: number;
  genres: string[];
  year?: string;
  media_type: string;
  watched?: boolean;
  watch_date?: string;
}

export default function Home() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trending, setTrending] = useState<MovieCard[]>([]);
  const [popular, setPopular] = useState<MovieCard[]>([]);
  const [topRated, setTopRated] = useState<MovieCard[]>([]);
  const [recommendations, setRecommendations] = useState<MovieCard[]>([]);
  const [watchlist, setWatchlist] = useState<MovieCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<MovieCard[]>([]);
  const [summary, setSummary] = useState({ total: 0, watchlist: 0, watched: 0 });

  const fetchHomeData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    setRefreshing(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const moviesResponse = await axios.get(`${API_URL}/api/movies`, { headers });
      const allMovies: MovieCard[] = moviesResponse.data || [];

      const watchlistMovies = allMovies.filter((movie) => !movie.watched).slice(0, 5);
      const recent = allMovies
        .filter((movie) => movie.watched)
        .sort((a, b) => new Date(b.watch_date || '').getTime() - new Date(a.watch_date || '').getTime())
        .slice(0, 5);

      setWatchlist(watchlistMovies);
      setRecentActivity(recent);
      setSummary({
        total: allMovies.length,
        watchlist: allMovies.filter((movie) => !movie.watched).length,
        watched: allMovies.filter((movie) => movie.watched).length,
      });

      const tmdbResponses = await Promise.allSettled([
        axios.get(`${API_URL}/api/tmdb/trending`, { headers }),
        axios.get(`${API_URL}/api/tmdb/popular`, { headers }),
        axios.get(`${API_URL}/api/tmdb/top-rated`, { headers }),
        axios.get(`${API_URL}/api/tmdb/recommendations`, { headers }),
      ]);

      const [trendingResult, popularResult, topRatedResult, recommendationsResult] = tmdbResponses;

      setTrending(
        trendingResult.status === 'fulfilled' ? trendingResult.value.data.results || [] : []
      );
      setPopular(
        popularResult.status === 'fulfilled' ? popularResult.value.data.results || [] : []
      );
      setTopRated(
        topRatedResult.status === 'fulfilled' ? topRatedResult.value.data.results || [] : []
      );
      setRecommendations(
        recommendationsResult.status === 'fulfilled' ? recommendationsResult.value.data.results || [] : []
      );

      if (
        trendingResult.status === 'rejected' ||
        popularResult.status === 'rejected' ||
        topRatedResult.status === 'rejected' ||
        recommendationsResult.status === 'rejected'
      ) {
        console.warn('Partial TMDB fetch failure', {
          trendingResult,
          popularResult,
          topRatedResult,
          recommendationsResult,
        });
      }
    } catch (error: any) {
      console.error('Error loading home data:', error);
      Alert.alert('Unable to load home screen', 'Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
    }, [fetchHomeData])
  );

  const renderCard = (movie: MovieCard) => (
    <View key={`${movie.tmdb_id}-${movie.title}`} style={styles.card}>
      {movie.poster_path ? (
        <Image
          source={{ uri: `${POSTER_BASE}${movie.poster_path}` }}
          style={styles.cardImage}
        />
      ) : (
        <View style={[styles.cardImage, styles.cardPlaceholder]}>
          <Ionicons name="film-outline" size={38} color="#999" />
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {movie.title}
      </Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardGenre}>{movie.year || movie.media_type}</Text>
        {typeof movie.tmdb_rating === 'number' ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.ratingText}>{movie.tmdb_rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHomeData();
  };

  const renderHorizontalSection = (title: string, items: MovieCard[]) => (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{items.length} items</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {items.length > 0 ? items.slice(0, 6).map(renderCard) : <Text style={styles.emptyText}>No results yet.</Text>}
      </ScrollView>
    </View>
  );

  const renderSummaryCard = (label: string, value: string) => (
    <View style={styles.summaryBox} key={label}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#E50914']}
            tintColor="#E50914"
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSubtitle}>Discover trending picks and keep tracking your watchlist.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color="#E50914" size="large" />
          </View>
        ) : (
          <>
            {renderHorizontalSection('Trending today', trending)}
            {renderHorizontalSection('Popular this week', popular)}
            {renderHorizontalSection('Top-rated movies', topRated)}
            {renderHorizontalSection('Personal recommendations', recommendations)}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Continue Watching</Text>
              {watchlist.length > 0 ? (
                <View style={styles.watchlistRow}>
                  {watchlist.map((movie) => (
                    <View key={`${movie.tmdb_id}-${movie.title}`} style={styles.continueCard}>
                      <Text style={styles.continueTitle} numberOfLines={2}>{movie.title}</Text>
                      <Text style={styles.continueMeta}>{movie.media_type} · {movie.year || 'TBD'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>Your watchlist is empty. Add titles to keep watching.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {recentActivity.length > 0 ? (
                recentActivity.map((movie) => {
                  return (
                    <View key={`${movie.tmdb_id}-${movie.title}`} style={styles.activityRow}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{movie.title}</Text>
                      <Text style={styles.activityMeta}>{movie.watch_date ? new Date(movie.watch_date).toLocaleDateString() : 'Today'}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No watched activity yet. Mark films as watched to build your history.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Watchlist Summary</Text>
              <View style={styles.summaryRow}>
                {renderSummaryCard('Total items', summary.total.toString())}
                {renderSummaryCard('Watchlist', summary.watchlist.toString())}
                {renderSummaryCard('Watched', summary.watched.toString())}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#333',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#AAA',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingWrapper: {
    marginTop: 60,
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#777',
    fontSize: 12,
  },
  horizontalScroll: {
    paddingBottom: 4,
  },
  card: {
    width: 140,
    marginRight: 12,
  },
  cardImage: {
    width: 140,
    height: 210,
    borderRadius: 16,
    backgroundColor: '#222',
  },
  cardPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    lineHeight: 18,
  },
  cardMeta: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardGenre: {
    color: '#888',
    fontSize: 11,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#FFD700',
    fontSize: 11,
  },
  watchlistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  continueCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#1D1D1D',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  continueTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  continueMeta: {
    color: '#888',
    fontSize: 12,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1D1D1D',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    marginBottom: 10,
  },
  activityTitle: {
    color: '#FFF',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  activityMeta: {
    color: '#777',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#1D1D1D',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    alignItems: 'center',
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#777',
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyText: {
    color: '#777',
    fontSize: 13,
    lineHeight: 20,
  },
});
