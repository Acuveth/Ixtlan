import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { DatabaseProvider } from './context/DatabaseContext';
import { ChatProvider } from './context/ChatContext';
import { canAccessRoute } from './config/roleAccess';
import Layout from './components/layout/Layout';
import HomeScreen from './pages/Home/HomeScreen';
import PlanBuilder from './pages/PlanBuilder/PlanBuilder';
import PlannedWork from './pages/PlannedWork/PlannedWork';
import LabQueue from './pages/LabQueue/LabQueue';
import PlanGenerator from './pages/PlanGenerator/PlanGenerator';
import ObservationRoom from './pages/ObservationRoom/ObservationRoom';
import PipelineTracker from './pages/Pipeline/PipelineTracker';
import BudgetDashboard from './pages/Budget/BudgetDashboard';
import AdminPanel from './pages/Admin/AdminPanel';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import LocationDetail from './pages/LocationDetail/LocationDetail';
import Locations from './pages/Locations/Locations';

function ProtectedRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const { currentUser } = useUser();
  if (!canAccessRoute(currentUser.role, path)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <UserProvider>
      <DatabaseProvider>
        <ChatProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/plans" element={<ProtectedRoute path="/plans"><PlanBuilder /></ProtectedRoute>} />
              <Route path="/plan-generator" element={<ProtectedRoute path="/plan-generator"><PlanGenerator /></ProtectedRoute>} />
              <Route path="/planned-work" element={<ProtectedRoute path="/planned-work"><PlannedWork /></ProtectedRoute>} />
              <Route path="/lab-queue" element={<ProtectedRoute path="/lab-queue"><LabQueue /></ProtectedRoute>} />
              <Route path="/observation" element={<ProtectedRoute path="/observation"><ObservationRoom /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute path="/pipeline"><PipelineTracker /></ProtectedRoute>} />
              <Route path="/budget" element={<ProtectedRoute path="/budget"><BudgetDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute path="/admin"><AdminPanel /></ProtectedRoute>} />
              <Route path="/locations" element={<ProtectedRoute path="/locations"><Locations /></ProtectedRoute>} />
              <Route path="/locations/:id" element={<ProtectedRoute path="/locations"><LocationDetail /></ProtectedRoute>} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </ChatProvider>
      </DatabaseProvider>
    </UserProvider>
  );
}

export default App;
