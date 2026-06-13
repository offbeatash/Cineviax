import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import CineviaxLogo from '../../components/CineviaxLogo';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface Movie {
  id: string;
  title: string;
  poster_base64?: string;
  media_type: 'movie' | 'tv';
  watched: boolean;
  personal_rating?: number;
  genres: string[];
  year?: string;
  watch_date?: string;
  added_at?: string;
}

export default function Profile() {
  const { user, token, updateProfile, logout } = useAuth();
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const handleUnauthorizedError = async (error: any) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await logout();
      router.replace('/auth/login');
      return true;
    }
    return false;
  };

  const fetchMovies = useCallback(async () => {
    if (!token) {
      setLoadingMovies(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/api/movies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMovies(response.data);
    } catch (error: any) {
      if (await handleUnauthorizedError(error)) {
        return;
      }
      setMovies([]);
    } finally {
      setLoadingMovies(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setName(user?.name || '');
      fetchMovies();
    }, [fetchMovies, user?.name])
  );

  const library = useMemo(() => {
    const watchlist = movies
      .filter((movie) => !movie.watched)
      .sort(
        (a, b) =>
          new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime()
      );
    const watched = movies
      .filter((movie) => movie.watched)
      .sort(
        (a, b) =>
          new Date(b.watch_date || 0).getTime() - new Date(a.watch_date || 0).getTime()
      );
    const ratings = watched
      .map((movie) => movie.personal_rating)
      .filter((rating): rating is number => typeof rating === 'number' && rating > 0);
    const genreCounts = watched
      .flatMap((movie) => movie.genres || [])
      .reduce<Record<string, number>>((counts, genre) => {
        counts[genre] = (counts[genre] || 0) + 1;
        return counts;
      }, {});
    const favoriteGenre =
      Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Not enough data';

    return {
      watchlist,
      watched,
      moviesWatched: watched.filter((movie) => movie.media_type === 'movie').length,
      seriesWatched: watched.filter((movie) => movie.media_type === 'tv').length,
      averageRating:
        ratings.length > 0
          ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)
          : '--',
      favoriteGenre,
    };
  }, [movies]);

  const handleSaveName = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Invalid name', 'Name cannot be empty.');
      return;
    }

    setSavingName(true);
    try {
      await updateProfile(trimmedName);
      setEditingName(false);
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Could not update your name');
    } finally {
      setSavingName(false);
    }
  };

  const performLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to log out?')) {
        performLogout();
      }
      return;
    }

    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: performLogout },
    ]);
  };

  const handleCreateAccount = async () => {
    await logout();
    router.replace('/auth/signup');
  };

  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'C';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchMovies();
            }}
            colors={['#E50914']}
            tintColor="#E50914"
          />
        }
      >
        <View style={styles.header}>
          <CineviaxLogo size={42} />
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          {editingName ? (
            <View style={styles.nameEditor}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={80}
                autoFocus
              />
              <TouchableOpacity
                style={styles.saveNameButton}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="checkmark" size={22} color="#FFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelNameButton}
                onPress={() => {
                  setName(user?.name || '');
                  setEditingName(false);
                }}
              >
                <Ionicons name="close" size={22} color="#AAA" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user?.name || 'Cineviax User'}</Text>
              {!user?.is_guest ? (
                <TouchableOpacity
                  style={styles.editNameButton}
                  onPress={() => setEditingName(true)}
                >
                  <Ionicons name="pencil-outline" size={17} color="#E50914" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <Text style={styles.contactText}>{user?.email || 'Guest profile'}</Text>
          <View style={[styles.badge, user?.is_guest && styles.guestBadge]}>
            <Ionicons
              name={user?.is_guest ? 'person-outline' : 'shield-checkmark-outline'}
              size={14}
              color={user?.is_guest ? '#FFD166' : '#4CAF50'}
            />
            <Text style={[styles.badgeText, user?.is_guest && styles.guestBadgeText]}>
              {user?.is_guest ? 'Guest account' : 'Registered account'}
            </Text>
          </View>
        </View>

        <SectionTitle title="Continue Watching" />
        <MovieShelf
          movies={library.watchlist.slice(0, 5)}
          emptyText="Nothing waiting for you yet."
          onViewAll={() => router.push('/main/watchlist')}
        />

        <SectionTitle title="Recently Watched" />
        <MovieShelf
          movies={library.watched.slice(0, 5)}
          emptyText="Your recently watched titles will appear here."
          onViewAll={() => router.push('/main/watched')}
        />

        <SectionTitle title="Watchlist" />
        <MovieShelf
          movies={library.watchlist.slice(0, 8)}
          emptyText="Add movies or series to build your watchlist."
          onViewAll={() => router.push('/main/watchlist')}
        />

        <SectionTitle title="Statistics" />
        {loadingMovies ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#E50914" />
          </View>
        ) : (
          <View style={styles.statsCard}>
            <StatRow icon="person-outline" label="Username" value={user?.name || 'Guest User'} />
            <StatRow
              icon="film-outline"
              label="Movies Watched"
              value={library.moviesWatched.toString()}
            />
            <StatRow
              icon="tv-outline"
              label="Series Watched"
              value={library.seriesWatched.toString()}
            />
            <StatRow
              icon="bookmark-outline"
              label="Watchlist Count"
              value={library.watchlist.length.toString()}
            />
            <StatRow icon="star-outline" label="Average Rating" value={library.averageRating} />
            <StatRow
              icon="heart-outline"
              label="Favorite Genre"
              value={library.favoriteGenre}
              last
            />
          </View>
        )}

        <SectionTitle title="Personal Information" />
        <View style={styles.detailsCard}>
          <ProfileRow icon="person-outline" label="Name" value={user?.name || 'Not provided'} />
          <ProfileRow icon="mail-outline" label="Email" value={user?.email || 'Not provided'} />
          <ProfileRow icon="call-outline" label="Phone" value={user?.phone || 'Not provided'} last />
        </View>

        {user?.is_guest ? (
          <View style={styles.guestNotice}>
            <Ionicons name="information-circle-outline" size={22} color="#FFD166" />
            <Text style={styles.guestNoticeText}>
              Guest data is tied to this session. Create an account to keep a permanent profile.
            </Text>
          </View>
        ) : null}

        {user?.is_guest ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreateAccount}>
            <Ionicons name="person-add-outline" size={20} color="#FFF" />
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MovieShelf({
  movies,
  emptyText,
  onViewAll,
}: {
  movies: Movie[];
  emptyText: string;
  onViewAll: () => void;
}) {
  if (movies.length === 0) {
    return (
      <TouchableOpacity style={styles.emptyShelf} onPress={onViewAll}>
        <Ionicons name="film-outline" size={28} color="#555" />
        <Text style={styles.emptyShelfText}>{emptyText}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelfContent}
    >
      {movies.map((movie) => (
        <TouchableOpacity key={movie.id} style={styles.posterCard} onPress={onViewAll}>
          {movie.poster_base64 ? (
            <Image source={{ uri: movie.poster_base64 }} style={styles.poster} />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="film-outline" size={30} color="#666" />
            </View>
          )}
          <Text style={styles.posterTitle} numberOfLines={2}>
            {movie.title}
          </Text>
          <Text style={styles.posterMeta}>
            {movie.media_type === 'tv' ? 'Series' : 'Movie'}
            {movie.year ? ` | ${movie.year}` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function StatRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.statRow, last && styles.lastRow]}>
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={19} color="#E50914" />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.lastRow]}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={21} color="#E50914" />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  headerTitle: {
    color: '#E50914',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 18,
    padding: 24,
    marginTop: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#303030',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: '#FFF',
    fontSize: 23,
    fontWeight: 'bold',
  },
  editNameButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#351A1C',
  },
  nameEditor: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    height: 46,
    color: '#FFF',
    backgroundColor: '#171717',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E50914',
    paddingHorizontal: 12,
    fontSize: 16,
  },
  saveNameButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
  },
  cancelNameButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  contactText: {
    color: '#888',
    fontSize: 13,
    marginTop: 7,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#172A19',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginTop: 10,
  },
  guestBadge: {
    backgroundColor: '#302A18',
  },
  badgeText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  guestBadgeText: {
    color: '#FFD166',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 4,
  },
  shelfContent: {
    gap: 12,
    paddingBottom: 24,
  },
  posterCard: {
    width: 112,
  },
  poster: {
    width: 112,
    height: 164,
    borderRadius: 12,
    backgroundColor: '#222',
  },
  posterPlaceholder: {
    width: 112,
    height: 164,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  posterTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 7,
    lineHeight: 17,
  },
  posterMeta: {
    color: '#777',
    fontSize: 10,
    marginTop: 3,
  },
  emptyShelf: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#202020',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
  },
  emptyShelfText: {
    flex: 1,
    color: '#777',
    fontSize: 13,
    lineHeight: 19,
  },
  loadingCard: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    borderRadius: 16,
    marginBottom: 24,
  },
  statsCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#303030',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  statLabel: {
    color: '#AAA',
    fontSize: 14,
  },
  statValue: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  detailsCard: {
    backgroundColor: '#222',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#303030',
  },
  detailIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#351A1C',
    marginRight: 13,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    color: '#777',
    fontSize: 12,
    marginBottom: 3,
  },
  detailValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#292617',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  guestNoticeText: {
    flex: 1,
    color: '#D8C98B',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#E50914',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5A2929',
    backgroundColor: '#241919',
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
