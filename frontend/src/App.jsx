import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Home from "./pages/Home.jsx";
import UserMarketplace from "./pages/UserMarketplace.jsx";
import ServiceDetail from "./pages/ServiceDetail.jsx";
import CreatorDashboard from "./pages/CreatorDashboard.jsx";
import CreateService from "./pages/CreateService.jsx";
import PredictionDashboard from "./pages/PredictionDashboard.jsx";
import UserDashboard from "./pages/UserDashboard.jsx";
import TransactionHistory from "./pages/TransactionHistory.jsx";
import HostedApps from "./pages/HostedApps.jsx";
import DevDashboard from "./pages/DevDashboard.jsx";
import StudioToolPage from "./pages/StudioToolPage.jsx";
import StudioQueue from "./pages/StudioQueue.jsx";
import StudioExports from "./pages/StudioExports.jsx";
import StudioStorage from "./pages/StudioStorage.jsx";
import MarketplaceCreators from "./pages/MarketplaceCreators.jsx";
import MarketplaceLayout from "./layouts/MarketplaceLayout.jsx";
import StudioLayout from "./layouts/StudioLayout.jsx";
import StudioHome from "./pages/studio/StudioHome.jsx";
import BloggingAgent from "./pages/studio/BloggingAgent.jsx";
import StudioProjects from "./pages/studio/Projects.jsx";
import ProjectDetail from "./pages/studio/ProjectDetail.jsx";
import StudioCalendar from "./pages/studio/Calendar.jsx";
import StudioDrafts from "./pages/studio/Drafts.jsx";
import StudioPublished from "./pages/studio/Published.jsx";
import StudioPlatforms from "./pages/studio/Platforms.jsx";
import StudioAnalytics from "./pages/studio/Analytics.jsx";
import StudioPlan from "./pages/studio/StudioPlan.jsx";
import ClipCraft from "./pages/studio/ClipCraft.jsx";
const WorkflowStudioHub = lazy(() => import("./pages/WorkflowStudioHub.jsx"));
const WorkflowBuilder = lazy(() => import("./pages/WorkflowBuilder.jsx"));
const WorkflowTemplates = lazy(() => import("./pages/WorkflowTemplates.jsx"));
const WorkflowHistory = lazy(() => import("./pages/WorkflowHistory.jsx"));

function StudioSuspense({ children }) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-slate-500">Loading studio module…</div>
      }
    >
      {children}
    </Suspense>
  );
}

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-body text-on-surface-variant">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === "user" ? "/dashboard/home" : "/creator"} replace />;
  }
  return children;
}

function ProfileGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A] font-body text-slate-400">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ProfileRedirect() {
  const { user } = useAuth();
  if (user?.role === "creator") {
    return <Navigate to="/creator" replace />;
  }
  return <Navigate to="/dashboard/home" replace />;
}

function RedirectUserService() {
  const { id } = useParams();
  return <Navigate to={`/dashboard/services/${id}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/profile"
        element={
          <ProfileGuard>
            <ProfileRedirect />
          </ProfileGuard>
        }
      />

      <Route path="/user/marketplace" element={<Navigate to="/dashboard/browse" replace />} />
      <Route path="/user/dashboard" element={<Navigate to="/dashboard/home" replace />} />
      <Route path="/user/analytics" element={<Navigate to="/dashboard/usage" replace />} />
      <Route path="/user/transactions" element={<Navigate to="/billing/transactions" replace />} />
      <Route path="/user/apps" element={<Navigate to="/studio/apps" replace />} />

      <Route path="/marketplace" element={<Navigate to="/dashboard/browse" replace />} />
      <Route path="/marketplace/home" element={<Navigate to="/dashboard/home" replace />} />
      <Route path="/marketplace/featured" element={<Navigate to="/dashboard/featured" replace />} />
      <Route path="/marketplace/categories" element={<Navigate to="/dashboard/categories" replace />} />
      <Route path="/marketplace/keys" element={<Navigate to="/dashboard/keys" replace />} />
      <Route path="/marketplace/usage" element={<Navigate to="/dashboard/usage" replace />} />
      <Route path="/marketplace/creators" element={<Navigate to="/dashboard/creators" replace />} />
      <Route
        path="/marketplace/services/:id"
        element={
          <Guard role="user">
            <RedirectUserService />
          </Guard>
        }
      />

      <Route
        path="/dashboard"
        element={
          <Guard role="user">
            <MarketplaceLayout />
          </Guard>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<UserDashboard />} />
        <Route path="browse" element={<UserMarketplace />} />
        <Route path="featured" element={<UserMarketplace />} />
        <Route path="categories" element={<UserMarketplace />} />
        <Route path="keys" element={<UserDashboard />} />
        <Route path="usage" element={<PredictionDashboard />} />
        <Route path="creators" element={<MarketplaceCreators />} />
        <Route path="services/:id" element={<ServiceDetail />} />
      </Route>

      <Route
        path="/user/services/:id"
        element={
          <Guard role="user">
            <RedirectUserService />
          </Guard>
        }
      />

      <Route
        path="/billing"
        element={
          <Guard role="user">
            <MarketplaceLayout />
          </Guard>
        }
      >
        <Route path="transactions" element={<TransactionHistory />} />
      </Route>

      <Route path="/user/hosted-apps" element={<Navigate to="/studio/apps" replace />} />

      <Route
        path="/studio"
        element={
          <Guard role="user">
            <StudioLayout />
          </Guard>
        }
      >
        <Route index element={<StudioHome />} />
        <Route
          path="workflows"
          element={
            <StudioSuspense>
              <WorkflowStudioHub />
            </StudioSuspense>
          }
        />
        <Route
          path="workflows/templates"
          element={
            <StudioSuspense>
              <WorkflowTemplates />
            </StudioSuspense>
          }
        />
        <Route
          path="workflows/history"
          element={
            <StudioSuspense>
              <WorkflowHistory />
            </StudioSuspense>
          }
        />
        <Route
          path="workflows/:workflowId"
          element={
            <StudioSuspense>
              <WorkflowBuilder />
            </StudioSuspense>
          }
        />
        <Route path="blogging-agent" element={<BloggingAgent />} />
        <Route path="clipcraft" element={<ClipCraft />} />
        <Route path="projects" element={<StudioProjects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="calendar" element={<StudioCalendar />} />
        <Route path="drafts" element={<StudioDrafts />} />
        <Route path="published" element={<StudioPublished />} />
        <Route path="platforms" element={<StudioPlatforms />} />
        <Route path="analytics" element={<StudioAnalytics />} />
        <Route path="plan" element={<StudioPlan />} />
        <Route path="apps" element={<HostedApps />} />
        <Route path="queue" element={<StudioQueue />} />
        <Route path="exports" element={<StudioExports />} />
        <Route path="storage" element={<StudioStorage />} />
        <Route path="video-editor" element={<Navigate to="/studio/clipcraft" replace />} />
        <Route path="blog-writer" element={<Navigate to="/studio/blogging-agent" replace />} />
        <Route
          path="data-analyst"
          element={
            <StudioToolPage
              tool="AI Data Analyst"
              description="Analyze datasets, generate summaries, and produce insight-first reports."
              icon="monitoring"
            />
          }
        />
      </Route>

      <Route
        path="/creator"
        element={
          <Guard role="creator">
            <CreatorDashboard />
          </Guard>
        }
      />
      <Route
        path="/creator/new"
        element={
          <Guard role="creator">
            <CreateService />
          </Guard>
        }
      />
      <Route path="/dev-dashboard" element={<DevDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
