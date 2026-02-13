import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Tutor from './pages/Tutor'
import Quiz from './pages/Quiz'
import Analytics from './pages/Analytics'
import Roadmap from './pages/Roadmap'
import Memory from './pages/Memory'
import Sessions from './pages/Sessions'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Tutor /> },
      { path: 'quiz', element: <Quiz /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'roadmap', element: <Roadmap /> },
      { path: 'memory', element: <Memory /> },
      { path: 'sessions', element: <Sessions /> }
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
