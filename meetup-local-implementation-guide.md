# MeetUp.local — Платформа микро-встреч для поиска друзей

Для запуска проекта:

# 1. Запустить Expo Dev Server
npm start

# или напрямую для конкретной платформы:
npm run android    # Android эмулятор/устройство
npm run ios        # iOS симулятор (только на macOS)
npm run web        # Веб-версия в браузере

После npm start:

Откроется Expo DevTools в терминале
Нажмите a для Android, i для iOS, w для веб
Или отсканируйте QR-код в приложении Expo Go на телефоне
Требования:

Для Android: Android Studio с эмулятором или Expo Go на устройстве
Для iOS: Xcode (только macOS) или Expo Go на iPhone
Для веб: просто браузер
Если на Windows с Android:

npm run android

Android SDK не установлен. Есть 3 варианта:

Вариант 1: Запустить веб-версию (самый быстрый)
npm run web

Откроется в браузере - удобно для разработки UI.

Вариант 2: Использовать Expo Go на телефоне
npm start

Установите Expo Go из Google Play на Android-телефон
Отсканируйте QR-код из терминала
Приложение запустится на телефоне
Вариант 3: Установить Android Studio
Скачайте Android Studio
При установке выберите "Android SDK"
После установки добавьте переменные среды:
# В PowerShell (от администратора):
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:LOCALAPPDATA\Android\Sdk\platform-tools", "User")

Перезапустите терминал
Создайте эмулятор в Android Studio → Device Manager
Запустите: npm run android
Рекомендую начать с npm run web - это самый быстрый способ увидеть приложение.



## Полное руководство по реализации MVP

---

## 1. Обзор проекта

### 1.1 Концепция

**MeetUp.local** (или СвоиЛюди) — мобильная платформа для организации локальных встреч по интересам в России. Ключевая особенность — платная подписка для организаторов и участников как механизм верификации и фильтрации несерьёзных пользователей.

### 1.2 Проблема, которую решаем

- Meetup.com неактуален в России
- Telegram-чаты хаотичны, сложно найти релевантные встречи
- Нет гарантии, что люди придут (no-show problem)
- Сложно найти единомышленников для офлайн-активностей

### 1.3 Типы активностей

- Настольные игры (Мафия, Монополия, Каркассон)
- Спорт (футбол, волейбол, ролики, велосипед)
- Интеллектуальные игры (мафия, квизы)
- Прогулки и экскурсии
- Языковые практики
- Хобби-встречи

### 1.4 Модель верификации

| Тип пользователя | Стоимость | Возможности |
|------------------|-----------|-------------|
| Организатор | 499₽/мес | Создание неограниченных встреч, модерация участников, аналитика |
| Участник | 199₽/мес | Запись на любые встречи, чат, отзывы |
| Разовое участие | 99₽ за встречу | Без подписки, оплата за конкретную встречу |

---

## 2. Технический стек

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| Mobile | React Native + Expo | Кроссплатформенная разработка |
| Backend | Supabase (PostgreSQL + PostGIS + Auth + Realtime + Edge Functions) | BaaS с геолокацией |
| UI | NativeWind + React Native Paper | Стилизация компонентов |
| Maps | Yandex Maps SDK | Карты для России |
| Push | expo-notifications + Supabase webhooks | Уведомления |
| Chat | Supabase Realtime | Real-time messaging |
| Payments | YooKassa | Российские платежи |
| State | Zustand | State management |
| Forms | React Hook Form + Zod | Валидация форм |

---

## 3. Промт для Claude Code

```markdown
# Проект: MeetUp.local - Платформа микро-встреч

## Контекст проекта
Разрабатываем мобильную платформу для организации локальных встреч по интересам в России. Ключевая особенность — платная подписка для организаторов и участников как механизм верификации и фильтрации несерьёзных пользователей.

## Проблема, которую решаем
- Meetup.com неактуален в России
- Telegram-чаты хаотичны, сложно найти релевантные встречи
- Нет гарантии, что люди придут (no-show problem)
- Сложно найти единомышленников для офлайн-активностей

## Технический стек
- **Mobile:** React Native + Expo
- **Backend:** Supabase (PostgreSQL + PostGIS + Auth + Realtime + Edge Functions)
- **UI:** NativeWind + React Native Paper
- **Maps:** Yandex Maps SDK (React Native binding)
- **Push:** expo-notifications + Supabase webhooks
- **Chat:** Supabase Realtime
- **Payments:** YooKassa
- **State:** Zustand
- **Forms:** React Hook Form + Zod

## Архитектура данных

```sql
-- Расширение для геолокации
CREATE EXTENSION IF NOT EXISTS postgis;

-- Профили пользователей
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  birth_year INTEGER,
  city TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  interests TEXT[],
  subscription_type TEXT CHECK (subscription_type IN ('free', 'participant', 'organizer')),
  subscription_expires_at TIMESTAMPTZ,
  rating DECIMAL(3,2) DEFAULT 5.0,
  reviews_count INTEGER DEFAULT 0,
  events_organized INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Категории активностей
CREATE TABLE activity_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id UUID REFERENCES activity_categories(id),
  is_active BOOLEAN DEFAULT true
);

-- Мероприятия/встречи
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Основная информация
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES activity_categories(id),
  tags TEXT[],
  
  -- Время и место
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  timezone TEXT DEFAULT 'Europe/Moscow',
  
  -- Локация
  location GEOGRAPHY(POINT, 4326),
  address TEXT NOT NULL,
  place_name TEXT,
  place_details TEXT,
  city TEXT NOT NULL,
  
  -- Участники
  min_participants INTEGER DEFAULT 2,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  
  -- Настройки
  is_public BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  allow_chat BOOLEAN DEFAULT true,
  
  -- Стоимость участия
  entry_fee DECIMAL(10,2) DEFAULT 0,
  
  -- Статус
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  cancelled_reason TEXT,
  
  -- Метрики
  views_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для геопоиска
CREATE INDEX events_location_idx ON events USING GIST (location);
CREATE INDEX events_starts_at_idx ON events (starts_at);
CREATE INDEX events_city_idx ON events (city);

-- Участники мероприятий
CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled', 'attended', 'no_show')),
  
  -- Оплата разового участия
  payment_id TEXT,
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  
  message_to_organizer TEXT,
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  UNIQUE(event_id, user_id)
);

-- Отзывы
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  review_type TEXT CHECK (review_type IN ('organizer_to_participant', 'participant_to_organizer')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(event_id, reviewer_id, reviewee_id)
);

-- Чат мероприятия
CREATE TABLE event_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  
  is_system BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Подписки приложения
CREATE TABLE app_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('participant', 'organizer')),
  
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  payment_id TEXT,
  amount DECIMAL(10,2),
  
  is_active BOOLEAN DEFAULT true,
  auto_renew BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Разовые платежи за участие
CREATE TABLE event_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  amount DECIMAL(10,2) NOT NULL,
  
  yookassa_payment_id TEXT,
  status TEXT CHECK (status IN ('pending', 'succeeded', 'cancelled', 'refunded')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Избранные мероприятия
CREATE TABLE saved_events (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

-- Уведомления
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  
  data JSONB,
  
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Бизнес-логика

### Тарифы подписок:
- **Участник (199₽/мес):** запись на любые встречи, чат, отзывы
- **Организатор (499₽/мес):** всё из "Участник" + создание встреч без лимита
- **Разовое участие (99₽):** без подписки, оплата за конкретную встречу

### Правила no-show:
- Первый no-show: предупреждение
- Второй no-show: временный бан на 7 дней
- Третий no-show: бан на 30 дней
- Организатор отмечает присутствие в течение 2 часов после начала

### Рейтинговая система:
- После встречи участники оценивают организатора (1-5)
- Организатор оценивает участников
- Рейтинг влияет на видимость в поиске

## Основные экраны

### 1. Discovery (главный)
- Карта с метками встреч поблизости
- Список встреч с фильтрами (категория, дата, расстояние)
- Поиск по названию/тегам

### 2. Event Details
- Полная информация о встрече
- Список участников (с аватарами)
- Чат встречи
- Кнопка записи / отмены

### 3. Create Event
- Wizard создания встречи
- Выбор места на карте
- Настройки участников

### 4. My Events
- Организованные мной
- Участвую
- История

### 5. Profile
- Информация о себе
- Интересы
- Отзывы
- Статистика

### 6. Chat
- Список чатов по встречам
- Real-time messaging

## Файловая структура
```
meetup-local/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding/
│   │       ├── interests.tsx
│   │       ├── location.tsx
│   │       └── subscription.tsx
│   ├── (tabs)/
│   │   ├── index.tsx
│   │   ├── my-events.tsx
│   │   ├── chats.tsx
│   │   └── profile.tsx
│   ├── event/
│   │   ├── [id].tsx
│   │   ├── create.tsx
│   │   └── edit/[id].tsx
│   ├── user/[id].tsx
│   ├── subscription.tsx
│   └── _layout.tsx
├── components/
│   ├── ui/
│   ├── events/
│   │   ├── EventCard.tsx
│   │   ├── EventMap.tsx
│   │   ├── ParticipantsList.tsx
│   │   └── EventChat.tsx
│   ├── discovery/
│   │   ├── MapView.tsx
│   │   ├── FilterSheet.tsx
│   │   └── SearchBar.tsx
│   └── common/
├── services/
│   ├── supabase/
│   ├── location/
│   ├── payments/
│   └── notifications/
├── stores/
│   ├── events.ts
│   ├── auth.ts
│   ├── location.ts
│   └── chat.ts
├── hooks/
│   ├── useLocation.ts
│   ├── useSubscription.ts
│   └── useEventChat.ts
├── utils/
│   ├── geo.ts
│   └── date.ts
├── constants/
│   ├── categories.ts
│   └── cities.ts
└── types/
```

## API функции (Supabase Edge Functions)

### search-events
Поиск встреч с фильтрами и геолокацией.

### join-event
Запись на встречу с проверкой подписки и оплатой.

### mark-attendance
Отметка присутствия организатором.

### process-no-shows
Cron job для обработки no-shows после завершения встречи.

## Приоритет реализации

### Phase 1 (MVP - 4 недели):
1. Auth + onboarding (интересы, город)
2. Базовый discovery (список, без карты)
3. Создание встречи (простая форма)
4. Запись на встречу (без оплаты)
5. Базовый профиль

### Phase 2 (Core - 3 недели):
1. Карта с Yandex Maps
2. Геопоиск встреч
3. Чат встречи (Supabase Realtime)
4. Push-уведомления

### Phase 3 (Monetization - 2 недели):
1. YooKassa интеграция
2. Подписки (участник/организатор)
3. Разовая оплата участия
4. Paywall

### Phase 4 (Trust & Safety - 2 недели):
1. Отметка присутствия
2. No-show система
3. Рейтинги и отзывы
4. Модерация контента

### Phase 5 (Polish - 1 неделя):
1. Animations
2. Offline support
3. Deep links
4. App store assets

## Начни с Phase 1, создай проект и базовую структуру.
```

---

## 4. План реализации по неделям

### Неделя 1: Инфраструктура и Auth

#### День 1-2: Настройка проекта

```bash
npx create-expo-app meetup-local -t expo-template-blank-typescript
cd meetup-local

# Core dependencies
npx expo install expo-router expo-location expo-notifications
npm install @supabase/supabase-js zustand nativewind
npm install react-hook-form @hookform/resolvers zod
npm install date-fns

# UI
npm install react-native-paper react-native-safe-area-context
npx expo install react-native-reanimated react-native-gesture-handler

# Maps (Yandex)
npm install react-native-yamap
```

#### День 3-4: Supabase + миграции

```sql
-- Включаем PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Все таблицы из схемы выше
-- ...

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Events policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published events"
  ON events FOR SELECT
  USING (status = 'published' OR organizer_id = auth.uid());

CREATE POLICY "Organizers can manage own events"
  ON events FOR ALL
  USING (organizer_id = auth.uid());
```

#### День 5-7: Auth flow

```typescript
// app/(auth)/register.tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  displayName: z.string().min(2, 'Минимум 2 символа'),
  city: z.string().min(1, 'Выберите город')
});

export default function RegisterScreen() {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema)
  });
  
  const onSubmit = async (data) => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.displayName,
          city: data.city
        }
      }
    });
    
    if (!error) {
      router.push('/onboarding/interests');
    }
  };
  
  return (
    <View className="flex-1 p-4">
      <Text className="text-2xl font-bold mb-6">Создать аккаунт</Text>
      
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            label="Email"
            value={value}
            onChangeText={onChange}
            error={!!errors.email}
          />
        )}
      />
      {/* ... остальные поля */}
    </View>
  );
}
```

---

### Неделя 2: Onboarding и Discovery

#### День 1-2: Выбор интересов

```typescript
// constants/categories.ts
export const ACTIVITY_CATEGORIES = [
  {
    id: 'board-games',
    name: 'Настольные игры',
    icon: '🎲',
    color: '#8B5CF6',
    subcategories: ['Мафия', 'Монополия', 'Каркассон', 'Кодовые имена']
  },
  {
    id: 'sports',
    name: 'Спорт',
    icon: '⚽',
    color: '#10B981',
    subcategories: ['Футбол', 'Волейбол', 'Баскетбол', 'Теннис', 'Бадминтон']
  },
  {
    id: 'outdoor',
    name: 'Активный отдых',
    icon: '🚴',
    color: '#F59E0B',
    subcategories: ['Ролики', 'Велосипед', 'Походы', 'Бег']
  },
  {
    id: 'intellectual',
    name: 'Интеллектуальные',
    icon: '🧠',
    color: '#3B82F6',
    subcategories: ['Квизы', 'Дебаты', 'Шахматы']
  },
  {
    id: 'languages',
    name: 'Языковые практики',
    icon: '🌍',
    color: '#EC4899',
    subcategories: ['Английский', 'Немецкий', 'Испанский', 'Китайский']
  },
  {
    id: 'creative',
    name: 'Творчество',
    icon: '🎨',
    color: '#EF4444',
    subcategories: ['Рисование', 'Музыка', 'Фотография']
  },
  {
    id: 'walks',
    name: 'Прогулки',
    icon: '🚶',
    color: '#6366F1',
    subcategories: ['Экскурсии', 'Фотопрогулки', 'Городские квесты']
  }
];

// app/(auth)/onboarding/interests.tsx
export default function InterestsScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  
  const toggleInterest = (id: string) => {
    setSelected(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };
  
  const handleContinue = async () => {
    await supabase
      .from('profiles')
      .update({ interests: selected })
      .eq('id', user.id);
    
    router.push('/onboarding/subscription');
  };
  
  return (
    <View className="flex-1 p-4">
      <Text className="text-2xl font-bold mb-2">Что тебе интересно?</Text>
      <Text className="text-gray-500 mb-6">Выбери минимум 3 категории</Text>
      
      <ScrollView>
        <View className="flex-row flex-wrap gap-2">
          {ACTIVITY_CATEGORIES.map(cat => (
            <Pressable
              key={cat.id}
              onPress={() => toggleInterest(cat.id)}
              className={`px-4 py-3 rounded-full border ${
                selected.includes(cat.id) 
                  ? 'bg-primary border-primary' 
                  : 'border-gray-300'
              }`}
            >
              <Text>{cat.icon} {cat.name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      
      <Button 
        disabled={selected.length < 3}
        onPress={handleContinue}
      >
        Продолжить
      </Button>
    </View>
  );
}
```

#### День 3-5: Discovery список

```typescript
// stores/events.ts
interface EventsStore {
  events: Event[];
  filters: EventFilters;
  isLoading: boolean;
  
  fetchEvents: () => Promise<void>;
  setFilters: (filters: Partial<EventFilters>) => void;
}

export const useEventsStore = create<EventsStore>((set, get) => ({
  events: [],
  filters: {
    category: null,
    dateFrom: new Date(),
    dateTo: addDays(new Date(), 30),
    maxDistance: 10, // km
  },
  isLoading: false,
  
  fetchEvents: async () => {
    set({ isLoading: true });
    
    const { filters } = get();
    const { data: location } = await Location.getCurrentPositionAsync();
    
    // Вызываем Edge Function для геопоиска
    const { data, error } = await supabase.functions.invoke('search-events', {
      body: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        maxDistance: filters.maxDistance * 1000, // в метрах
        category: filters.category,
        dateFrom: filters.dateFrom.toISOString(),
        dateTo: filters.dateTo.toISOString()
      }
    });
    
    set({ events: data || [], isLoading: false });
  }
}));

// supabase/functions/search-events/index.ts
Deno.serve(async (req) => {
  const { latitude, longitude, maxDistance, category, dateFrom, dateTo } = await req.json();
  
  const supabase = createClient(/* ... */);
  
  let query = supabase
    .from('events')
    .select(`
      *,
      organizer:profiles!organizer_id(id, display_name, avatar_url, rating),
      category:activity_categories(*),
      participants:event_participants(count)
    `)
    .eq('status', 'published')
    .gte('starts_at', dateFrom)
    .lte('starts_at', dateTo);
  
  if (category) {
    query = query.eq('category_id', category);
  }
  
  // Геофильтр через PostGIS
  const { data } = await query.rpc('events_within_distance', {
    lat: latitude,
    lon: longitude,
    distance_meters: maxDistance
  });
  
  return new Response(JSON.stringify(data));
});

// SQL function для геопоиска
CREATE OR REPLACE FUNCTION events_within_distance(
  lat FLOAT,
  lon FLOAT,
  distance_meters FLOAT
)
RETURNS SETOF events AS $$
  SELECT *
  FROM events
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    distance_meters
  )
  AND status = 'published'
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography;
$$ LANGUAGE sql;
```

#### День 6-7: Event Card компонент

```typescript
// components/events/EventCard.tsx
interface EventCardProps {
  event: Event;
  distance?: number;
}

export function EventCard({ event, distance }: EventCardProps) {
  const spotsLeft = event.max_participants 
    ? event.max_participants - event.current_participants
    : null;
  
  return (
    <Pressable 
      onPress={() => router.push(`/event/${event.id}`)}
      className="bg-white rounded-xl p-4 mb-3 shadow-sm"
    >
      {/* Категория и время */}
      <View className="flex-row items-center mb-2">
        <View 
          className="px-2 py-1 rounded-full mr-2"
          style={{ backgroundColor: event.category.color + '20' }}
        >
          <Text style={{ color: event.category.color }}>
            {event.category.icon} {event.category.name}
          </Text>
        </View>
        <Text className="text-gray-500">
          {format(new Date(event.starts_at), 'd MMM, HH:mm', { locale: ru })}
        </Text>
      </View>
      
      {/* Название */}
      <Text className="text-lg font-semibold mb-1">{event.title}</Text>
      
      {/* Место */}
      <View className="flex-row items-center mb-2">
        <MapPin size={16} className="text-gray-400 mr-1" />
        <Text className="text-gray-600 flex-1" numberOfLines={1}>
          {event.place_name || event.address}
        </Text>
        {distance && (
          <Text className="text-gray-400 ml-2">
            {distance < 1 ? `${Math.round(distance * 1000)} м` : `${distance.toFixed(1)} км`}
          </Text>
        )}
      </View>
      
      {/* Организатор и участники */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Avatar size={24} source={{ uri: event.organizer.avatar_url }} />
          <Text className="ml-2 text-gray-600">{event.organizer.display_name}</Text>
          <View className="flex-row items-center ml-2">
            <Star size={14} className="text-yellow-500" />
            <Text className="text-gray-600 ml-1">{event.organizer.rating.toFixed(1)}</Text>
          </View>
        </View>
        
        <View className="flex-row items-center">
          <Users size={16} className="text-gray-400 mr-1" />
          <Text className="text-gray-600">
            {event.current_participants}
            {event.max_participants && `/${event.max_participants}`}
          </Text>
          {spotsLeft !== null && spotsLeft <= 3 && spotsLeft > 0 && (
            <Text className="text-orange-500 ml-1">
              (осталось {spotsLeft})
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
```

---

### Неделя 3: Создание встречи и детали

#### День 1-3: Форма создания встречи

```typescript
// app/event/create.tsx
const createEventSchema = z.object({
  title: z.string().min(5, 'Минимум 5 символов').max(100),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid(),
  startsAt: z.date().min(new Date(), 'Дата должна быть в будущем'),
  durationMinutes: z.number().min(30).max(480),
  address: z.string().min(5),
  placeName: z.string().optional(),
  placeDetails: z.string().optional(),
  minParticipants: z.number().min(2).default(2),
  maxParticipants: z.number().min(2).max(100).optional(),
  requiresApproval: z.boolean().default(false),
  tags: z.array(z.string()).max(5)
});

export default function CreateEventScreen() {
  const { isPremium, subscriptionType } = useSubscription();
  const [location, setLocation] = useState<LatLng | null>(null);
  
  // Проверка подписки организатора
  if (subscriptionType !== 'organizer') {
    return <OrganizerPaywall />;
  }
  
  const { control, handleSubmit, watch } = useForm({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      minParticipants: 2,
      durationMinutes: 120,
      requiresApproval: false,
      tags: []
    }
  });
  
  const onSubmit = async (data) => {
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        ...data,
        organizer_id: user.id,
        location: `POINT(${location.longitude} ${location.latitude})`,
        city: await reverseGeocode(location),
        status: 'published'
      })
      .select()
      .single();
    
    if (!error) {
      router.replace(`/event/${event.id}`);
    }
  };
  
  return (
    <ScrollView className="flex-1 p-4">
      <Text className="text-2xl font-bold mb-6">Новая встреча</Text>
      
      {/* Категория */}
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <CategorySelector
            selected={field.value}
            onSelect={field.onChange}
          />
        )}
      />
      
      {/* Название */}
      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <TextInput
            label="Название встречи"
            placeholder="Например: Играем в Мафию в центре"
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      
      {/* Дата и время */}
      <Controller
        control={control}
        name="startsAt"
        render={({ field }) => (
          <DateTimePicker
            label="Когда"
            value={field.value}
            onChange={field.onChange}
            minimumDate={new Date()}
          />
        )}
      />
      
      {/* Карта для выбора места */}
      <Text className="text-lg font-semibold mt-4 mb-2">Где</Text>
      <LocationPicker
        value={location}
        onChange={setLocation}
        onAddressChange={(address) => setValue('address', address)}
      />
      
      {/* ... остальные поля */}
      
      <Button onPress={handleSubmit(onSubmit)} className="mt-6">
        Создать встречу
      </Button>
    </ScrollView>
  );
}
```

#### День 4-5: Страница встречи

```typescript
// app/event/[id].tsx
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { subscriptionType } = useSubscription();
  
  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchEventDetails(id)
  });
  
  const isOrganizer = event?.organizer_id === user?.id;
  const isParticipant = event?.participants?.some(p => p.user_id === user?.id);
  const canJoin = !isOrganizer && !isParticipant && 
    (event?.max_participants ? event.current_participants < event.max_participants : true);
  
  const handleJoin = async () => {
    // Проверка подписки
    if (subscriptionType === 'free') {
      // Показываем paywall с опцией разовой оплаты
      router.push(`/event/${id}/pay`);
      return;
    }
    
    const { error } = await supabase
      .from('event_participants')
      .insert({
        event_id: id,
        user_id: user.id,
        status: event.requires_approval ? 'pending' : 'approved'
      });
    
    if (!error) {
      // Обновляем счётчик
      await supabase.rpc('increment_participants', { event_id: id });
      refetch();
    }
  };
  
  return (
    <ScrollView className="flex-1">
      {/* Header с картой */}
      <View className="h-48">
        <MapView
          initialRegion={{
            latitude: event.location.coordinates[1],
            longitude: event.location.coordinates[0],
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
          }}
        >
          <Marker coordinate={event.location.coordinates} />
        </MapView>
      </View>
      
      <View className="p-4">
        {/* Категория и статус */}
        <View className="flex-row items-center mb-2">
          <CategoryBadge category={event.category} />
          {event.requires_approval && (
            <Badge variant="outline" className="ml-2">Модерация</Badge>
          )}
        </View>
        
        {/* Название */}
        <Text className="text-2xl font-bold mb-2">{event.title}</Text>
        
        {/* Дата и время */}
        <View className="flex-row items-center mb-4">
          <Calendar size={20} className="text-gray-500 mr-2" />
          <Text className="text-gray-700">
            {format(new Date(event.starts_at), "EEEE, d MMMM 'в' HH:mm", { locale: ru })}
          </Text>
        </View>
        
        {/* Место */}
        <Pressable 
          onPress={() => openMaps(event.location)}
          className="flex-row items-start mb-4"
        >
          <MapPin size={20} className="text-gray-500 mr-2 mt-0.5" />
          <View className="flex-1">
            <Text className="text-gray-700">{event.place_name || event.address}</Text>
            {event.place_details && (
              <Text className="text-gray-500 text-sm">{event.place_details}</Text>
            )}
          </View>
          <ExternalLink size={16} className="text-primary" />
        </Pressable>
        
        {/* Организатор */}
        <Pressable 
          onPress={() => router.push(`/user/${event.organizer.id}`)}
          className="flex-row items-center p-3 bg-gray-50 rounded-xl mb-4"
        >
          <Avatar size={48} source={{ uri: event.organizer.avatar_url }} />
          <View className="ml-3 flex-1">
            <Text className="font-semibold">{event.organizer.display_name}</Text>
            <View className="flex-row items-center">
              <Star size={14} className="text-yellow-500" />
              <Text className="text-gray-600 ml-1">
                {event.organizer.rating.toFixed(1)} · {event.organizer.events_organized} встреч
              </Text>
            </View>
          </View>
          <ChevronRight size={20} className="text-gray-400" />
        </Pressable>
        
        {/* Описание */}
        {event.description && (
          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2">О встрече</Text>
            <Text className="text-gray-700">{event.description}</Text>
          </View>
        )}
        
        {/* Участники */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-semibold">
              Участники ({event.current_participants}
              {event.max_participants && `/${event.max_participants}`})
            </Text>
          </View>
          <ParticipantsList 
            participants={event.participants} 
            maxVisible={5}
          />
        </View>
        
        {/* Чат */}
        {(isOrganizer || isParticipant) && event.allow_chat && (
          <Pressable 
            onPress={() => router.push(`/event/${id}/chat`)}
            className="flex-row items-center justify-between p-4 bg-primary/10 rounded-xl mb-4"
          >
            <View className="flex-row items-center">
              <MessageCircle size={24} className="text-primary mr-3" />
              <Text className="font-semibold text-primary">Чат встречи</Text>
            </View>
            <ChevronRight size={20} className="text-primary" />
          </Pressable>
        )}
      </View>
      
      {/* Bottom action */}
      <View className="p-4 border-t border-gray-100">
        {canJoin && (
          <Button onPress={handleJoin} size="lg" className="w-full">
            {subscriptionType === 'free' ? 'Записаться (99₽)' : 'Записаться'}
          </Button>
        )}
        {isParticipant && (
          <Button variant="outline" onPress={handleCancel} size="lg" className="w-full">
            Отменить участие
          </Button>
        )}
        {isOrganizer && (
          <Button onPress={() => router.push(`/event/${id}/manage`)} size="lg" className="w-full">
            Управление встречей
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
```

#### День 6-7: Список участников и управление

---

### Неделя 4: Карта и геолокация

#### День 1-3: Yandex Maps интеграция

```typescript
// components/discovery/MapView.tsx
import YaMap, { Marker, Clusterer } from 'react-native-yamap';

YaMap.init('YOUR_YANDEX_API_KEY');

interface EventMapProps {
  events: Event[];
  userLocation: LatLng;
  onEventPress: (eventId: string) => void;
}

export function EventMap({ events, userLocation, onEventPress }: EventMapProps) {
  const mapRef = useRef<YaMap>(null);
  
  return (
    <YaMap
      ref={mapRef}
      style={{ flex: 1 }}
      initialRegion={{
        lat: userLocation.latitude,
        lon: userLocation.longitude,
        zoom: 12
      }}
      showUserPosition
    >
      <Clusterer
        clusterColor="#6366F1"
        onClusterPress={(cluster) => {
          mapRef.current?.fitAllMarkers();
        }}
      >
        {events.map(event => (
          <Marker
            key={event.id}
            point={{
              lat: event.location.coordinates[1],
              lon: event.location.coordinates[0]
            }}
            onPress={() => onEventPress(event.id)}
          >
            <View className="bg-white rounded-full p-2 shadow-lg">
              <Text>{event.category.icon}</Text>
            </View>
          </Marker>
        ))}
      </Clusterer>
    </YaMap>
  );
}
```

#### День 4-5: Переключение карта/список

```typescript
// app/(tabs)/index.tsx
export default function DiscoveryScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const { events, filters, setFilters, fetchEvents, isLoading } = useEventsStore();
  const { location } = useLocation();
  
  useEffect(() => {
    if (location) {
      fetchEvents();
    }
  }, [location, filters]);
  
  return (
    <View className="flex-1">
      {/* Header с поиском и фильтрами */}
      <View className="p-4 bg-white border-b border-gray-100">
        <SearchBar 
          placeholder="Поиск встреч..."
          onSearch={(query) => setFilters({ search: query })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <FilterChip
            label="Категория"
            value={filters.category}
            onPress={() => openCategoryFilter()}
          />
          <FilterChip
            label="Дата"
            value={filters.dateRange}
            onPress={() => openDateFilter()}
          />
          <FilterChip
            label={`${filters.maxDistance} км`}
            onPress={() => openDistanceFilter()}
          />
        </ScrollView>
      </View>
      
      {/* View mode toggle */}
      <View className="flex-row p-2 bg-gray-100">
        <Pressable
          onPress={() => setViewMode('list')}
          className={`flex-1 py-2 rounded-lg ${viewMode === 'list' ? 'bg-white' : ''}`}
        >
          <Text className="text-center">Список</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('map')}
          className={`flex-1 py-2 rounded-lg ${viewMode === 'map' ? 'bg-white' : ''}`}
        >
          <Text className="text-center">Карта</Text>
        </Pressable>
      </View>
      
      {/* Content */}
      {viewMode === 'list' ? (
        <FlatList
          data={events}
          renderItem={({ item }) => (
            <EventCard 
              event={item} 
              distance={calculateDistance(location, item.location)}
            />
          )}
          keyExtractor={item => item.id}
          contentContainerClassName="p-4"
          refreshing={isLoading}
          onRefresh={fetchEvents}
          ListEmptyComponent={<EmptyState />}
        />
      ) : (
        <EventMap
          events={events}
          userLocation={location}
          onEventPress={(id) => router.push(`/event/${id}`)}
        />
      )}
    </View>
  );
}
```

#### День 6-7: Фильтры

---

### Неделя 5: Realtime чат

#### День 1-3: Чат встречи

```typescript
// app/event/[id]/chat.tsx
export default function EventChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Загрузка истории
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('event_messages')
        .select(`
          *,
          user:profiles(id, display_name, avatar_url)
        `)
        .eq('event_id', id)
        .order('created_at', { ascending: true });
      
      setMessages(data || []);
    };
    
    fetchMessages();
  }, [id]);
  
  // Realtime подписка
  useEffect(() => {
    const channel = supabase
      .channel(`event-chat-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${id}`
        },
        async (payload) => {
          // Получаем полные данные с профилем
          const { data } = await supabase
            .from('event_messages')
            .select(`*, user:profiles(id, display_name, avatar_url)`)
            .eq('id', payload.new.id)
            .single();
          
          if (data) {
            setMessages(prev => [...prev, data]);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);
  
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    await supabase.from('event_messages').insert({
      event_id: id,
      user_id: user.id,
      content: newMessage.trim()
    });
    
    setNewMessage('');
  };
  
  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble 
            message={item} 
            isOwn={item.user_id === user.id}
          />
        )}
        keyExtractor={item => item.id}
        contentContainerClassName="p-4"
        inverted={false}
      />
      
      <View className="flex-row items-center p-4 border-t border-gray-100">
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Сообщение..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
          multiline
          maxLength={500}
        />
        <Pressable 
          onPress={sendMessage}
          disabled={!newMessage.trim()}
          className="w-10 h-10 bg-primary rounded-full items-center justify-center"
        >
          <Send size={20} className="text-white" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
```

#### День 4-5: Push-уведомления

```typescript
// services/notifications/setup.ts
import * as Notifications from 'expo-notifications';

export async function setupNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  
  if (status !== 'granted') {
    return null;
  }
  
  const token = await Notifications.getExpoPushTokenAsync();
  
  // Сохраняем токен в профиль
  await supabase
    .from('profiles')
    .update({ push_token: token.data })
    .eq('id', user.id);
  
  // Настройка обработчиков
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  
  return token;
}

// supabase/functions/send-notification/index.ts
// Webhook для отправки push при новом сообщении
Deno.serve(async (req) => {
  const { record, type } = await req.json();
  
  if (type === 'INSERT' && record.table === 'event_messages') {
    // Получаем участников события
    const { data: participants } = await supabase
      .from('event_participants')
      .select('user_id, profiles(push_token)')
      .eq('event_id', record.event_id)
      .neq('user_id', record.user_id); // исключаем автора
    
    // Отправляем push через Expo
    const pushTokens = participants
      .map(p => p.profiles?.push_token)
      .filter(Boolean);
    
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        pushTokens.map(token => ({
          to: token,
          title: 'Новое сообщение',
          body: record.content.substring(0, 100),
          data: { eventId: record.event_id }
        }))
      )
    });
  }
  
  return new Response('OK');
});
```

#### День 6-7: Напоминания о встречах

---

### Неделя 6: Монетизация

#### День 1-3: YooKassa интеграция

```typescript
// supabase/functions/create-payment/index.ts
const PRICES = {
  participant_monthly: 199,
  organizer_monthly: 499,
  single_event: 99
};

Deno.serve(async (req) => {
  const { type, userId, eventId } = await req.json();
  
  const amount = PRICES[type];
  const description = type === 'single_event' 
    ? 'Разовое участие во встрече'
    : type === 'organizer_monthly'
      ? 'Подписка организатора (1 месяц)'
      : 'Подписка участника (1 месяц)';
  
  // Создаём платёж в YooKassa
  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(SHOP_ID + ':' + SECRET_KEY)}`,
      'Idempotence-Key': crypto.randomUUID()
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: {
        type: 'redirect',
        return_url: `https://yourapp.com/payment/callback?type=${type}&userId=${userId}&eventId=${eventId || ''}`
      },
      capture: true,
      description,
      metadata: { type, userId, eventId }
    })
  });
  
  const payment = await response.json();
  
  return new Response(JSON.stringify({
    paymentId: payment.id,
    confirmationUrl: payment.confirmation.confirmation_url
  }));
});

// Webhook для подтверждения платежа
Deno.serve(async (req) => {
  const { event, object } = await req.json();
  
  if (event === 'payment.succeeded') {
    const { type, userId, eventId } = object.metadata;
    
    if (type === 'single_event') {
      // Подтверждаем участие
      await supabase
        .from('event_participants')
        .update({ payment_status: 'paid', status: 'approved' })
        .eq('event_id', eventId)
        .eq('user_id', userId);
    } else {
      // Активируем подписку
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      
      await supabase.from('app_subscriptions').insert({
        user_id: userId,
        type: type.replace('_monthly', ''),
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: object.id,
        amount: object.amount.value
      });
      
      await supabase
        .from('profiles')
        .update({
          subscription_type: type.replace('_monthly', ''),
          subscription_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId);
    }
  }
  
  return new Response('OK');
});
```

#### День 4-5: Paywall UI

```typescript
// app/subscription.tsx
export default function SubscriptionScreen() {
  const { subscriptionType } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'participant' | 'organizer'>('participant');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubscribe = async () => {
    setIsLoading(true);
    
    const { data } = await supabase.functions.invoke('create-payment', {
      body: {
        type: `${selectedPlan}_monthly`,
        userId: user.id
      }
    });
    
    // Открываем страницу оплаты
    await WebBrowser.openBrowserAsync(data.confirmationUrl);
    setIsLoading(false);
  };
  
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <Text className="text-3xl font-bold text-center mb-2">
          Выбери свой план
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          Платная подписка — гарантия серьёзных намерений
        </Text>
        
        {/* Plan cards */}
        <View className="gap-4 mb-8">
          {/* Участник */}
          <Pressable
            onPress={() => setSelectedPlan('participant')}
            className={`p-4 rounded-2xl border-2 ${
              selectedPlan === 'participant' 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-200'
            }`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold">Участник</Text>
              <Text className="text-2xl font-bold">199₽<Text className="text-base font-normal text-gray-500">/мес</Text></Text>
            </View>
            <View className="gap-2">
              <FeatureItem icon="✓" text="Запись на любые встречи" />
              <FeatureItem icon="✓" text="Чат с участниками" />
              <FeatureItem icon="✓" text="Оставлять отзывы" />
              <FeatureItem icon="✓" text="Верифицированный профиль" />
            </View>
          </Pressable>
          
          {/* Организатор */}
          <Pressable
            onPress={() => setSelectedPlan('organizer')}
            className={`p-4 rounded-2xl border-2 ${
              selectedPlan === 'organizer' 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-200'
            }`}
          >
            <View className="absolute -top-3 right-4 bg-orange-500 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-bold">ПОПУЛЯРНЫЙ</Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold">Организатор</Text>
              <Text className="text-2xl font-bold">499₽<Text className="text-base font-normal text-gray-500">/мес</Text></Text>
            </View>
            <View className="gap-2">
              <FeatureItem icon="✓" text="Всё из плана Участник" />
              <FeatureItem icon="✓" text="Создание неограниченных встреч" />
              <FeatureItem icon="✓" text="Модерация участников" />
              <FeatureItem icon="✓" text="Аналитика встреч" />
              <FeatureItem icon="✓" text="Приоритет в поиске" />
            </View>
          </Pressable>
        </View>
        
        {/* Без подписки */}
        <View className="p-4 bg-gray-50 rounded-xl mb-8">
          <Text className="font-semibold mb-1">Без подписки?</Text>
          <Text className="text-gray-600">
            Можно участвовать во встречах за 99₽ за каждую
          </Text>
        </View>
        
        <Button 
          onPress={handleSubscribe} 
          isLoading={isLoading}
          size="lg"
          className="w-full"
        >
          Подписаться за {selectedPlan === 'participant' ? '199' : '499'}₽/мес
        </Button>
        
        <Text className="text-gray-400 text-center text-sm mt-4">
          Отменить можно в любой момент. Возврат за неиспользованный период.
        </Text>
      </View>
    </ScrollView>
  );
}
```

#### День 6-7: Premium gating

---

### Неделя 7: Trust & Safety

#### День 1-2: Отметка присутствия

```typescript
// app/event/[id]/manage.tsx (для организатора)
export default function ManageEventScreen() {
  const { id } = useLocalSearchParams();
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const markAttendance = async (participantId: string, attended: boolean) => {
    await supabase
      .from('event_participants')
      .update({ 
        status: attended ? 'attended' : 'no_show' 
      })
      .eq('id', participantId);
    
    if (!attended) {
      // Инкремент no-show счётчика
      await supabase.rpc('increment_no_show', { 
        p_user_id: participant.user_id 
      });
    }
    
    refetch();
  };
  
  return (
    <View className="flex-1 p-4">
      <Text className="text-xl font-bold mb-4">Отметка присутствия</Text>
      
      {participants.map(p => (
        <View 
          key={p.id}
          className="flex-row items-center justify-between p-3 bg-white rounded-xl mb-2"
        >
          <View className="flex-row items-center">
            <Avatar source={{ uri: p.user.avatar_url }} size={40} />
            <Text className="ml-3 font-medium">{p.user.display_name}</Text>
          </View>
          
          {p.status === 'approved' ? (
            <View className="flex-row gap-2">
              <IconButton
                icon="check"
                mode="contained"
                containerColor="#10B981"
                onPress={() => markAttendance(p.id, true)}
              />
              <IconButton
                icon="close"
                mode="contained"
                containerColor="#EF4444"
                onPress={() => markAttendance(p.id, false)}
              />
            </View>
          ) : (
            <Badge 
              variant={p.status === 'attended' ? 'success' : 'destructive'}
            >
              {p.status === 'attended' ? 'Был' : 'Не пришёл'}
            </Badge>
          )}
        </View>
      ))}
    </View>
  );
}
```

#### День 3-4: No-show система

```typescript
// supabase/functions/process-no-shows/index.ts
// Cron job: каждый час
Deno.serve(async () => {
  const twoHoursAgo = new Date();
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
  
  // Находим завершённые события без отметки
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .eq('status', 'published')
    .lt('starts_at', twoHoursAgo.toISOString());
  
  for (const event of events || []) {
    // Помечаем неотмеченных как no-show
    await supabase
      .from('event_participants')
      .update({ status: 'no_show' })
      .eq('event_id', event.id)
      .eq('status', 'approved');
    
    // Обновляем статус события
    await supabase
      .from('events')
      .update({ status: 'completed' })
      .eq('id', event.id);
  }
  
  // Обрабатываем баны
  const { data: offenders } = await supabase
    .from('profiles')
    .select('id, no_show_count')
    .gte('no_show_count', 2);
  
  for (const user of offenders || []) {
    const banDays = user.no_show_count === 2 ? 7 : 30;
    
    await supabase
      .from('profiles')
      .update({ 
        banned_until: new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', user.id);
    
    // Отправляем уведомление
    await sendPushNotification(user.id, {
      title: 'Временная блокировка',
      body: `Вы заблокированы на ${banDays} дней из-за неявок на встречи`
    });
  }
  
  return new Response('OK');
});
```

#### День 5-7: Рейтинги и отзывы

```typescript
// components/events/ReviewForm.tsx
export function ReviewForm({ eventId, revieweeId, type }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  
  const submitReview = async () => {
    await supabase.from('reviews').insert({
      event_id: eventId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment,
      review_type: type
    });
    
    // Пересчёт рейтинга
    await supabase.rpc('recalculate_rating', { p_user_id: revieweeId });
    
    router.back();
  };
  
  return (
    <View className="p-4">
      <Text className="text-lg font-semibold mb-4">Оцените встречу</Text>
      
      <View className="flex-row justify-center mb-6">
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable key={star} onPress={() => setRating(star)}>
            <Star
              size={40}
              fill={star <= rating ? '#F59E0B' : 'transparent'}
              color={star <= rating ? '#F59E0B' : '#D1D5DB'}
            />
          </Pressable>
        ))}
      </View>
      
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Комментарий (необязательно)"
        multiline
        numberOfLines={4}
        className="bg-gray-100 rounded-xl p-4 mb-4"
      />
      
      <Button onPress={submitReview}>Отправить отзыв</Button>
    </View>
  );
}
```

---

### Неделя 8: Polish и запуск

#### День 1-3: UI/UX polish

- Анимации переходов
- Skeleton loaders
- Error boundaries
- Haptic feedback

#### День 4-5: Тестирование

- E2E тесты с Detox
- Manual testing
- Performance profiling

#### День 6-7: Публикация

- App Store assets
- Google Play submission
- Landing page
- Документация

---

## 5. Архитектура системы

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native App                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Discovery │  │My Events │  │  Chats   │  │ Profile  │        │
│  │  (Map)   │  │          │  │          │  │          │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │                │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐          │
│  │                  Zustand Stores                    │          │
│  │   (events, auth, location, chat, subscription)     │          │
│  └────┬──────────────────────────────────────────┬───┘          │
│       │                                          │               │
│  ┌────┴────┐  ┌─────────┐                  ┌────┴────┐          │
│  │Yandex   │  │Location │                  │Supabase │          │
│  │Maps SDK │  │Service  │                  │Client   │          │
│  └─────────┘  └─────────┘                  └────┬────┘          │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 ▼
                                    ┌───────────────────────┐
                                    │      Supabase         │
                                    │  ┌─────────────────┐  │
                                    │  │   PostgreSQL    │  │
                                    │  │   + PostGIS     │  │
                                    │  ├─────────────────┤  │
                                    │  │    Realtime     │  │
                                    │  │   (Chat, Sync)  │  │
                                    │  ├─────────────────┤  │
                                    │  │ Edge Functions  │  │
                                    │  │ - search-events │  │
                                    │  │ - join-event    │  │
                                    │  │ - payments      │  │
                                    │  │ - no-shows      │  │
                                    │  └─────────────────┘  │
                                    └───────────┬───────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    │      YooKassa         │
                                    │   (Payments API)      │
                                    └───────────────────────┘
```

---

## 6. Бизнес-модель

### Тарифы

| Тариф | Цена | Функции |
|-------|------|---------|
| Free | 0₽ | Просмотр встреч, профиль |
| Участник | 199₽/мес | Запись на встречи, чат, отзывы, верификация |
| Организатор | 499₽/мес | Всё из "Участник" + создание встреч, модерация, аналитика |
| Разовое участие | 99₽ за встречу | Без подписки, оплата за конкретную встречу |

### Unit Economics (прогноз)

- CAC (Customer Acquisition Cost): ~200₽
- LTV (Lifetime Value): ~1500₽ (средний срок подписки 5 мес)
- LTV/CAC: 7.5x
- Gross Margin: ~80%

---

## 7. Правила модерации и безопасности

### No-show система

| No-show # | Последствие |
|-----------|-------------|
| 1 | Предупреждение |
| 2 | Бан на 7 дней |
| 3+ | Бан на 30 дней |

### Рейтинговая система

- Минимальный рейтинг: 1.0
- Максимальный рейтинг: 5.0
- При рейтинге < 3.0 — понижение в поиске
- При рейтинге < 2.0 — ручная модерация

### Модерация контента

- Автомодерация текста через AI
- Ручная модерация жалоб
- Бан за нарушения правил сообщества

---

## 8. Метрики успеха MVP

| Метрика | Target (3 мес) |
|---------|----------------|
| MAU | 2,000+ |
| События/неделя | 100+ |
| Средний размер встречи | 5+ человек |
| No-show rate | <15% |
| Premium Conversion | >5% |
| NPS | >50 |

---

## 9. Риски и митигация

| Риск | Вероятность | Импакт | Митигация |
|------|-------------|--------|-----------|
| Cold start (нет пользователей) | Высокая | Критический | Запуск в одном городе, seed-контент от команды |
| Высокий no-show rate | Средняя | Высокий | Платная верификация, система штрафов |
| Безопасность встреч | Низкая | Критический | Верификация, рейтинги, check-in система |
| Конкуренция с Telegram | Средняя | Средний | Уникальные фичи (карта, верификация, no-show) |

---

## 10. Стратегия запуска

### Этап 1: Soft Launch (1 город)

1. Выбрать город (рекомендуется Москва или СПб)
2. Создать 20-30 seed-событий от команды
3. Привлечь 200-500 early adopters
4. Собрать обратную связь

### Этап 2: Валидация

1. Достичь 50+ органических событий в неделю
2. No-show rate < 20%
3. NPS > 40

### Этап 3: Масштабирование

1. Запуск в 5 крупнейших городах
2. Маркетинговые кампании
3. Партнёрства с площадками

---

## 11. Roadmap после MVP

### Q2 2025
- iOS версия
- Интеграция с календарём
- Приватные встречи по ссылке

### Q3 2025
- Регулярные события (еженедельные)
- Группы по интересам
- Верификация через госуслуги

### Q4 2025
- Marketplace для организаторов
- Корпоративные аккаунты
- API для партнёров

---

## 12. Контакты и ресурсы

### Документация
- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [Yandex Maps SDK](https://yandex.ru/dev/maps/)
- [YooKassa API](https://yookassa.ru/developers)

### Полезные библиотеки
- `react-native-yamap` — Yandex Maps для RN
- `date-fns` — работа с датами
- `zod` — валидация
- `react-native-paper` — UI компоненты

---

*Документ создан: Декабрь 2024*
*Версия: 1.0*
