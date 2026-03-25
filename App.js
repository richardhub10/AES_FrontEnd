import axios from 'axios';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  FlatList,
  Platform,
  Pressable,
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
  const [screen, setScreen] = useState('home'); // 'home' | 'appointments'

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const DAILY_CAPACITY = Number(
    (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_DAILY_CAPACITY) ||
      10,
  );

  const [calendarCursor, setCalendarCursor] = useState(() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDateYmd, setSelectedDateYmd] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const scheduledForIso = useMemo(() => {
    if (!selectedDateYmd || !selectedTime) return '';
    // Treat user-selected time as UTC to match backend timezone (UTC).
    const d = new Date(`${selectedDateYmd}T${selectedTime}:00Z`);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }, [selectedDateYmd, selectedTime]);

  const bookedCountByDate = useMemo(() => {
    const map = new Map();
    for (const appt of appointments || []) {
      const ymd = typeof appt?.scheduled_for === 'string' ? appt.scheduled_for.slice(0, 10) : '';
      if (!ymd) continue;
      map.set(ymd, (map.get(ymd) || 0) + 1);
    }
    return map;
  }, [appointments]);

  const earliestAvailableYmd = useMemo(() => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 366; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const ymd = d.toISOString().slice(0, 10);
      const count = bookedCountByDate.get(ymd) || 0;
      if (count < DAILY_CAPACITY) return ymd;
    }
    return '';
  }, [bookedCountByDate, DAILY_CAPACITY]);

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
    setScreen('home');
  }

  useEffect(() => {
    fetchMe();
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token && screen === 'appointments') {
      fetchAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

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
              <Button
                title="Appointment"
                onPress={() => setScreen('appointments')}
                disabled={busy || screen === 'appointments'}
              />
              <View style={styles.spacer} />
              <Button title="Logout" onPress={logout} disabled={busy} />
            </View>

            <Text style={styles.hint}>
              Logged in as: {me?.username || username}
              {me?.is_staff ? ' (staff)' : ''}
            </Text>

            {screen === 'home' && (
              <Text style={styles.hint}>
                Click “Appointment” to create and view appointments.
              </Text>
            )}
          </View>

          {screen === 'appointments' && (
            <>
              <View style={styles.card}>
                <View style={styles.row}>
                  <Button title="Back" onPress={() => setScreen('home')} disabled={busy} />
                </View>

                <Text style={styles.sectionTitle}>Create Appointment</Text>

                <Text style={styles.label}>Scheduled For</Text>
                {!!earliestAvailableYmd && (
                  <Text style={styles.hint}>
                    Earliest available appointment: {earliestAvailableYmd}
                  </Text>
                )}

                <Calendar
                  cursor={calendarCursor}
                  onChangeCursor={setCalendarCursor}
                  selectedDateYmd={selectedDateYmd}
                  onSelectDateYmd={setSelectedDateYmd}
                  bookedCountByDate={bookedCountByDate}
                  dailyCapacity={DAILY_CAPACITY}
                />

                <Text style={styles.label}>Time (UTC)</Text>
                <TextInput
                  value={selectedTime}
                  onChangeText={setSelectedTime}
                  autoCapitalize="none"
                  style={styles.input}
                  placeholder="10:00"
                  {...(Platform.OS === 'web' ? { type: 'time' } : null)}
                />
                <Text style={styles.hint}>
                  Selected: {selectedDateYmd} {selectedTime}
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
                      <Text style={styles.itemTitle}>{item.status}</Text>
                      <Text style={styles.itemMeta}>{item.scheduled_for}</Text>
                      {!!item.reason && (
                        <Text style={styles.itemBody}>Reason: {item.reason}</Text>
                      )}
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

function Calendar({
  cursor,
  onChangeCursor,
  selectedDateYmd,
  onSelectDateYmd,
  bookedCountByDate,
  dailyCapacity,
}) {
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth(); // 0-11

  const monthName = cursor.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

  const weeks = useMemo(() => buildCalendarWeeksUtc(year, month), [year, month]);

  function prevMonth() {
    const d = new Date(cursor);
    d.setUTCMonth(d.getUTCMonth() - 1);
    d.setUTCDate(1);
    onChangeCursor(d);
  }

  function nextMonth() {
    const d = new Date(cursor);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(1);
    onChangeCursor(d);
  }

  function statusForYmd(ymd) {
    const count = bookedCountByDate.get(ymd) || 0;
    return count >= dailyCapacity ? 'full' : 'available';
  }

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeaderRow}>
        <Button title="<" onPress={prevMonth} />
        <Text style={styles.calendarTitle}>
          {monthName} {year}
        </Text>
        <Button title=">" onPress={nextMonth} />
      </View>

      <View style={styles.calendarWeekdaysRow}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Text key={d} style={styles.calendarWeekday}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.calendarWeekRow}>
          {week.map((cell, di) => {
            if (!cell) {
              return <View key={di} style={[styles.calendarDay, styles.calendarDayEmpty]} />;
            }

            const ymd = cell.ymd;
            const status = statusForYmd(ymd);
            const isSelected = ymd === selectedDateYmd;
            const disabled = status === 'full';

            return (
              <Pressable
                key={di}
                disabled={disabled}
                onPress={() => onSelectDateYmd(ymd)}
                style={({ pressed }) => [
                  styles.calendarDay,
                  status === 'available' ? styles.calendarDayAvailable : styles.calendarDayFull,
                  isSelected ? styles.calendarDaySelected : null,
                  disabled ? styles.calendarDayDisabled : null,
                  pressed ? styles.calendarDayPressed : null,
                ]}
              >
                <Text style={styles.calendarDayText}>{cell.day}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.calendarLegendRow}>
        <View style={[styles.legendChip, styles.legendAvailable]}>
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={[styles.legendChip, styles.legendFull]}>
          <Text style={styles.legendText}>Fully Booked</Text>
        </View>
      </View>
    </View>
  );
}

function buildCalendarWeeksUtc(year, monthIndex) {
  const first = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0));
    cells.push({
      day,
      ymd: d.toISOString().slice(0, 10),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
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

  calendarCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarTitle: {
    fontWeight: '700',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarWeekday: {
    width: 38,
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarDay: {
    width: 38,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayEmpty: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  calendarDayAvailable: {
    backgroundColor: '#e6f7e6',
  },
  calendarDayFull: {
    backgroundColor: '#fdecea',
  },
  calendarDaySelected: {
    borderColor: '#444',
    borderWidth: 2,
  },
  calendarDayPressed: {
    opacity: 0.8,
  },
  calendarDayDisabled: {
    opacity: 0.5,
  },
  calendarDayText: {
    fontWeight: '700',
  },
  calendarLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  legendChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  legendAvailable: {
    backgroundColor: '#e6f7e6',
    marginRight: 8,
  },
  legendFull: {
    backgroundColor: '#fdecea',
  },
  legendText: {
    fontWeight: '700',
  },
});
