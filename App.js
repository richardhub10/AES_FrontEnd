import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL =
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_API_BASE_URL) ||
  'https://aes-back.onrender.com';

export default function App() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [scheduledForLocal, setScheduledForLocal] = useState('2030-01-01T10:00');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const scheduledForIso = useMemo(() => {
    const d = parseDatetimeLocal(scheduledForLocal);
    return d ? d.toISOString() : '';
  }, [scheduledForLocal]);

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
    });

    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, [token]);

  async function onRegister() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/auth/register/', {
        username,
        password,
        email,
      });
      setMode('login');
      setError('Registered. Now log in.');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLogin() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/auth/token/', {
        username,
        password,
      });
      setToken(res.data.access);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function fetchMe() {
    if (!token) return;
    try {
      const res = await api.get('/api/auth/me/');
      setMe(res.data);
    } catch (e) {
      // Non-fatal
    }
  }

  async function fetchAppointments() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.get('/api/appointments/');
      setAppointments(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function setAppointmentStatus(id, status) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/appointments/${id}/`, { status });
      await fetchAppointments();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function createAppointment() {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/appointments/', {
        // Backend still expects this field; keep it out of the UI.
        doctor_name: 'General',
        scheduled_for: scheduledForIso,
        reason,
        notes,
      });
      setReason('');
      setNotes('');
      await fetchAppointments();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken(null);
    setMe(null);
    setAppointments([]);
  }

  useEffect(() => {
    fetchMe();
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>UA Clinic Appointment System</Text>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!token ? (
        <View style={styles.card}>
          <View style={styles.row}>
            <Button
              title="Login"
              onPress={() => setMode('login')}
              disabled={busy}
            />
            <View style={styles.spacer} />
            <Button
              title="Register"
              onPress={() => setMode('register')}
              disabled={busy}
            />
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          {mode === 'register' && (
            <>
              <Text style={styles.label}>Email (optional)</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                style={styles.input}
              />
            </>
          )}

          <Button
            title={mode === 'login' ? 'Login' : 'Create account'}
            onPress={mode === 'login' ? onLogin : onRegister}
            disabled={busy || !username || !password}
          />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.row}>
              <Button title="Refresh" onPress={fetchAppointments} disabled={busy} />
              <View style={styles.spacer} />
              <Button title="Logout" onPress={logout} disabled={busy} />
            </View>

            <Text style={styles.hint}>
              Logged in as: {me?.username || username}
              {me?.is_staff ? ' (staff)' : ''}
            </Text>

            <Text style={styles.sectionTitle}>Create Appointment</Text>

            <Text style={styles.label}>Scheduled For</Text>
            <TextInput
              value={scheduledForLocal}
              onChangeText={setScheduledForLocal}
              autoCapitalize="none"
              style={styles.input}
              placeholder="2030-01-01T10:00"
              // react-native-web forwards unknown props to the underlying <input>
              {...(Platform.OS === 'web' ? { type: 'datetime-local' } : null)}
            />
            <Text style={styles.hint}>
              {Platform.OS === 'web'
                ? 'Use the calendar/time picker.'
                : 'Format: YYYY-MM-DDTHH:mm (e.g. 2030-01-01T10:00)'}
            </Text>

            <Text style={styles.label}>Reason</Text>
            <TextInput value={reason} onChangeText={setReason} style={styles.input} />

            <Text style={styles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={styles.input} />

            <Button
              title="Create"
              onPress={createAppointment}
              disabled={busy || !scheduledForIso}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My Appointments</Text>
            <FlatList
              data={appointments}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={<Text style={styles.hint}>No appointments yet.</Text>}
              renderItem={({ item }) => (
                <View style={styles.item}>
                  <Text style={styles.itemTitle}>
                    {item.status}
                  </Text>
                  <Text style={styles.itemMeta}>{item.scheduled_for}</Text>
                  {!!item.reason && <Text style={styles.itemBody}>Reason: {item.reason}</Text>}
                  {!!item.notes && <Text style={styles.itemBody}>Notes: {item.notes}</Text>}

                  <View style={[styles.row, { marginTop: 8 }]}>
                    {me?.is_staff ? (
                      <>
                        <Button
                          title="Confirm"
                          onPress={() => setAppointmentStatus(item.id, 'confirmed')}
                          disabled={busy}
                        />
                        <View style={styles.spacer} />
                        <Button
                          title="Cancel"
                          onPress={() => setAppointmentStatus(item.id, 'cancelled')}
                          disabled={busy}
                        />
                      </>
                    ) : (
                      <Button
                        title="Cancel"
                        onPress={() => setAppointmentStatus(item.id, 'cancelled')}
                        disabled={busy}
                      />
                    )}
                  </View>
                </View>
              )}
            />
          </View>
        </>
      )}

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function getErrorMessage(e) {
  // Axios timeout errors (common with Render free-tier cold starts)
  if (e?.code === 'ECONNABORTED' || String(e?.message || '').toLowerCase().includes('timeout')) {
    return 'Backend did not respond in time. If the backend is on Render, wait 30–60 seconds and try again.';
  }

  // Browser network errors (DNS/CORS/offline)
  if (!e?.response && String(e?.message || '').toLowerCase().includes('network')) {
    return 'Network error contacting the backend. Check your connection and that the backend URL is correct.';
  }

  if (e?.response?.data) {
    if (typeof e.response.data === 'string') return e.response.data;
    return JSON.stringify(e.response.data);
  }
  return e?.message || 'Request failed';
}

function parseDatetimeLocal(value) {
  // Accepts `YYYY-MM-DDTHH:mm` (from <input type="datetime-local">)
  if (!value || typeof value !== 'string') return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: '#444',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  hint: {
    marginTop: 6,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: {
    width: 12,
  },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  item: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 10,
  },
  itemTitle: {
    fontWeight: '700',
  },
  itemMeta: {
    color: '#666',
    marginTop: 2,
  },
  itemBody: {
    marginTop: 4,
  },
  errorBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f5c2c0',
  },
  errorText: {
    color: '#8a1f17',
  },
});
