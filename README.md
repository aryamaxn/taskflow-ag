# TaskFlow — Stay in flow. ⚡

A modern, responsive **Dark Task Manager** web application built with **Node.js** and **Express**. Inspired by clean productivity dashboards, it features a near-black palette, muted slate blue smart lists, color-coded category tiles, periwinkle task cards, and an interactive month calendar.

---

## 🎨 Theme & Palette

- **Page Background**: Near-black (`#121212`) with dark surface cards (`#1a1a22` / `#22222d`).
- **Smart-List Cards**: Muted slate blue (`#4A5D8A`) for *My Day*, *Upcoming*, and *Important*.
- **Category Tiles** (Rounded corners ~16px):
  - 🔵 **Personal**: Light blue (`#7FA6F5`)
  - 🟣 **Work**: Purple (`#7B72E0`)
  - 🟣 **Learning**: Magenta (`#B567C9`)
  - 🟠 **Shopping**: Salmon (`#E8A0A0`)
- **Task Cards**: Light blue (`#8FB0F7`) with:
  - Round circular checkbox
  - Bold titles
  - Small colored category dot + label
  - Due date badge & importance star toggle
- **Typography**: Bold geometric **Poppins** from Google Fonts.
- **Favicon**: Violet tile extracted from the official TaskFlow icon (`favicon.png`).

---

## 📱 Responsive Layout Architecture

- **Mobile (< 768px)**:
  - Single-column flow with zero horizontal scrolling.
  - **Home Screen**: Greeting, 3 smart-list cards, and a **2-column category grid**.
  - **Upcoming View**: Interactive horizontal week strip with task cards for the selected day.
  - **Bottom Floating Action Button (`+`)**: Opens a quick-add modal with category and date pickers.
  - **Bottom Tab Bar**: Home, Upcoming, Calendar, and Profile (44px touch targets).
- **Tablet (768px – 1099px)**:
  - Smart-list cards in a row.
  - Category tiles in a **3-column grid**.
  - Comfortable margins and adaptive task list.
- **Laptop / Desktop (1100px+)**:
  - **Left Sidebar (~260px)**: TaskFlow logo, smart-list navigation with live counts, category list with color dots, and user profile with logout.
  - **Center Panel**: Current list/category title, filter pills (All, Active, Completed), inline "Add task" form, and main task card grid.
  - **Right Panel (~320px)**: Month calendar with clickable days, tasks for the selected day, and a "Today's progress" indicator.

---

## 🔐 Authentication & Database Architecture

- **Google OAuth 2.0**: Secure authentication via `passport-google-oauth20` and `express-session`.
- **Private Multi-User MongoDB**:
  - `User` model: `googleId`, `name`, `email`, `picture`, `createdAt`.
  - `Todo` model: `userId` (indexed foreign key), `title`, `category`, `dueDate`, `important`, `completed`, `createdAt`.
  - Every `/api/todos` query strictly filters by `req.user._id` — user tasks are completely private and isolated.
- **MongoDB Session Store**: Sessions persist in MongoDB via `connect-mongo` using secure HTTP-only cookies (`secure: true` in production).
- **Callback URL**: Dynamically built from `BASE_URL` so it works seamlessly on localhost and on any deployed production URL.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Local server port | `3000` |
| `BASE_URL` | Application root URL | `http://localhost:3000` or `https://your-app.onrender.com` |
| `MONGODB_URI` | MongoDB Atlas or local connection string | `mongodb+srv://user:pass@cluster.mongodb.net/taskflow` |
| `SESSION_SECRET` | Express session secret key | `super_secure_random_string` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-xxxx` |
| `NODE_ENV` | Environment mode | `development` or `production` |

---

## 🚀 Running the App Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the TaskFlow server:
   ```bash
   npm start
   ```

3. Open **[http://localhost:3000](http://localhost:3000)** in your browser:
   - Unauthenticated visitors are automatically directed to `/login`.
   - Click **"Continue with Google"** to authenticate via Google OAuth.
   - Tasks are privately saved to your MongoDB database!

