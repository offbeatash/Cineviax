import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../utils/api';

export default function Stats() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movies, setMovies] = useState<any[]>([]);

  const fetchStats = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const response = await axios.get(`${API_URL}/api/movies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMovies(response.data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [token])
  );

  const summary = useMemo(() => {
    const watched = movies.filter((movie) => movie.watched);
    const genres = watched.flatMap((movie) => movie.genres || []);
    const genreCounts = genres.reduce<Record<string, number>>((acc, genre) => {
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    const favoriteGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genre]) => genre);

    const ratingValues = watched
      .map((movie) => movie.personal_rating)
      .filter((rating) => typeof rating === 'number');

    return {
      watchCount: watched.length,
      averageRating:
        ratingValues.length > 0
          ? (ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(1)
          : '--',
      genreDistribution: Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      favoriteGenres,
    };
  }, [movies]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true) || fetchStats()} colors={['#E50914']} tintColor="#E50914" />
        }
      >
        <Text style={styles.title}>Stats</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#E50914" />
        ) : (
          <>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Watch count</Text>
              <Text style={styles.statValue}>{summary.watchCount}</Text>
              <Text style={styles.statNote}>Tracked watched movies and series</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average rating</Text>
              <Text style={styles.statValue}>{summary.averageRating}</Text>
              <Text style={styles.statNote}>Your personal score average</Text>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Genre distribution</Text>
              {summary.genreDistribution.length === 0 ? (
                <Text style={styles.emptyText}>No watched genres yet.</Text>
              ) : (
                summary.genreDistribution.map(([genre, count]) => (
                  <View key={genre} style={styles.barRow}>
                    <Text style={styles.barLabel}>{genre}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: Math.min((count / Math.max(...summary.genreDistribution.map(([_, value]) => value))) * 100, 100) + '%' }]} />
                    </View>
                    <Text style={styles.barValue}>{count}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.tagCard}>
              <Text style={styles.sectionTitle}>Favorite genres</Text>
              {summary.favoriteGenres.length === 0 ? (
                <Text style={styles.emptyText}>No favorite genres yet.</Text>
              ) : (
                <View style={styles.tagsRow}>
                  {summary.favoriteGenres.map((genre) => (
                    <View key={genre} style={styles.tagBubble}>
                      <Text style={styles.tagText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              )}
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
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 18,
  },
  statCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    marginBottom: 16,
  },
  statLabel: {
    color: '#AAA',
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  statNote: {
    color: '#777',
    marginTop: 8,
    fontSize: 13,
  },
  chartCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyText: {
    color: '#777',
    fontSize: 13,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barLabel: {
    color: '#EEE',
    fontSize: 13,
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#292929',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 10,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  barValue: {
    color: '#FFF',
    fontSize: 12,
    width: 24,
    textAlign: 'right',
  },
  tagCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagBubble: {
    backgroundColor: '#282828',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10,
  },
  tagText: {
    color: '#FFF',
    fontSize: 13,
  },
});
