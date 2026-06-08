import React, { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Home from "./pages/Home.jsx";
import UserMarketplace from "./pages/UserMarketplace.jsx";
import OnChainContract from "./pages/OnChainContract.jsx";
import CreatorDashboard from "./pages/CreatorDashboard.jsx";
import CreateService from "./pages/CreateService.jsx";
import PredictionDashboard from "./pages/PredictionDashboard.jsx";
import UserDashboard from "./pages/UserDashboard.jsx";
import GatewayWallet from "./pages/GatewayWallet.jsx";
import GatewayDeveloper from "./pages/GatewayDeveloper.jsx";
import GatewayMarketplace from "./pages/GatewayMarketplace.jsx";
import GatewayAdmin from "./pages/GatewayAdmin.jsx";
import TransactionHistory from "./pages/TransactionHistory.jsx";
import HostedApps from "./pages/HostedApps.jsx";
import DevDashboard from "./pages/DevDashboard.jsx";
import StudioToolPage from "./pages/StudioToolPage.jsx";
import StudioQueue from "./pages/StudioQueue.jsx";
import StudioExports from "./pages/StudioExports.jsx";
import StudioStorage from "./pages/StudioStorage.jsx";
import MarketplaceCreators from "./pages/MarketplaceCreators.jsx";
import CreatorProfile from "./pages/CreatorProfile.jsx";
import MarketplaceLayout from "./layouts/MarketplaceLayout.jsx";
import StudioLayout from "./layouts/StudioLayout.jsx";
import DocsLayout from "./layouts/DocsLayout.jsx";
import StudioHome from "./pages/studio/StudioHome.jsx";
import StudioProjects from "./pages/studio/Projects.jsx";
import ProjectDetail from "./pages/studio/ProjectDetail.jsx";
import StudioCalendar from "./pages/studio/Calendar.jsx";
import StudioDrafts from "./pages/studio/Drafts.jsx";
import StudioPublished from "./pages/studio/Published.jsx";
import StudioPlatforms from "./pages/studio/Platforms.jsx";
import StudioPlan from "./pages/studio/StudioPlan.jsx";
const ServiceDetail = lazy(() => import("./pages/ServiceDetail.jsx"));
const BloggingAgent = lazy(() => import("./pages/studio/BloggingAgent.jsx"));
const ClipCraft = lazy(() => import("./pages/studio/ClipCraft.jsx"));
const StudioAnalytics = lazy(() => import("./pages/studio/Analytics.jsx"));
const PromptGenerator = lazy(() => import("./pages/studio/PromptGenerator.jsx"));
const CreativeWorkflow = lazy(() => import("./pages/studio/CreativeWorkflow.jsx"));
const AgenticPipeline = lazy(() => import("./pages/studio/AgenticPipeline/index.jsx"));
const ViralThumbnailAI = lazy(() => import("./pages/studio/ViralThumbnailAI.jsx"));
import X402Docs from "./pages/X402Docs.jsx";
import X402DevDocs from "./pages/X402DevDocs.jsx";
import X402Playground from "./pages/X402Playground.jsx";
import WithdrawalDocs from "./pages/WithdrawalDocs.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import CliDocs from "./pages/CliDocs.jsx";
import MigrationDocs from "./pages/MigrationDocs.jsx";
import FaqDocs from "./pages/FaqDocs.jsx";
import PricingDocs from "./pages/PricingDocs.jsx";
import SdkDemo from "./pages/SdkDemo.jsx";
import SecureCalculator from "./pages/SecureCalculator.jsx";
const WorkflowStudioHub = lazy(() => import("./pages/WorkflowStudioHub.jsx"));
const StudioChat = lazy(() => import("./pages/studio/StudioChat.jsx"));
const WorkflowBuilder = lazy(() => import("./pages/WorkflowBuilder.jsx"));
const WorkflowTemplates = lazy(() => import("./pages/WorkflowTemplates.jsx"));
const WorkflowHistory = lazy(() => import("./pages/WorkflowHistory.jsx"));

/** Where signed-out users land when they hit a protected route (not the marketing homepage). */
const GUEST_FALLBACK = "/marketplace/browse";

function GuestFallback() {
  const location = useLocation();
  return (
    <Navigate
      to={GUEST_FALLBACK}
      replace
      state={{ from: `${location.pathname}${location.search}${location.hash}`, needsAuth: true }}
    />
  );
}

function AuthAwareRedirect({ authed, guest = GUEST_FALLBACK }) {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? authed : guest} replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-[#f9f9f9]">
      <h1 className="font-headline text-xl font-semibold text-primary">Page not found</h1>
      <p className="text-sm text-slate-500 max-w-md">
        That link may be outdated. Try one of these destinations instead.
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
        <Link to="/" className="text-secondary hover:underline">
          Home
        </Link>
        <Link to="/marketplace/browse" className="text-secondary hover:underline">
          Marketplace
        </Link>
        <Link to="/studio" className="text-secondary hover:underline">
          AI Studio
        </Link>
        <Link to="/docs/how-it-works" className="text-secondary hover:underline">
          Docs
        </Link>
      </div>
    </div>
  );
}

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
  const { user, loading, becomeCreator } = useAuth();
  const [promoting, setPromoting] = React.useState(false);
  const [promoted, setPromoted] = React.useState(false);

  React.useEffect(() => {
    if (loading || !user || role !== "creator" || user.role === "creator") {
      setPromoted(true);
      return;
    }
    if (!user.walletAddress) {
      setPromoted(true);
      return;
    }
    let cancelled = false;
    setPromoting(true);
    becomeCreator()
      .then(() => {
        if (!cancelled) setPromoted(true);
      })
      .catch(() => {
        if (!cancelled) setPromoted(true);
      })
      .finally(() => {
        if (!cancelled) setPromoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, user?.role, user?.walletAddress, role, becomeCreator]);

  if (loading || promoting || !promoted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface font-body text-on-surface-variant">
        Loading…
      </div>
    );
  }
  if (!user) {
    return <GuestFallback />;
  }
  // A Creator is also a valid user who can browse the marketplace and use studio tools
  if (role === "user" && (user.role === "user" || user.role === "creator")) {
    return children;
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
    return <GuestFallback />;
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
  return <Navigate to={`/marketplace/services/${id}`} replace />;
}

function RedirectMarketplaceCreator() {
  const { walletAddress } = useParams();
  return <Navigate to={`/marketplace/creators/${walletAddress}`} replace />;
}

function ServiceDetailRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading service…</div>}>
      <ServiceDetail />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sdk-demo" element={<SdkDemo />} />
      <Route path="/calculator" element={<SecureCalculator />} />
      <Route
        path="/profile"
        element={
          <ProfileGuard>
            <ProfileRedirect />
          </ProfileGuard>
        }
      />

      <Route path="/user/marketplace" element={<Navigate to="/marketplace/browse" replace />} />
      <Route
        path="/user/dashboard"
        element={<AuthAwareRedirect authed="/dashboard/home" guest="/marketplace/browse" />}
      />
      <Route path="/user/analytics" element={<Navigate to="/dashboard/usage" replace />} />
      <Route path="/user/transactions" element={<Navigate to="/billing/transactions" replace />} />
      <Route path="/user/apps" element={<Navigate to="/studio/apps" replace />} />

      {/* Public marketplace — browse without signing in */}
      <Route path="/marketplace" element={<MarketplaceLayout />}>
        <Route index element={<Navigate to="browse" replace />} />
        <Route path="browse" element={<UserMarketplace />} />
        <Route path="creators" element={<MarketplaceCreators />} />
        <Route path="creators/:walletAddress" element={<CreatorProfile />} />
        <Route path="gateway" element={<GatewayMarketplace />} />
        <Route path="services/:id" element={<ServiceDetailRoute />} />
      </Route>

      <Route
        path="/marketplace/home"
        element={<AuthAwareRedirect authed="/dashboard/home" guest="/marketplace/browse" />}
      />
      <Route path="/marketplace/featured" element={<Navigate to="/marketplace/browse" replace />} />
      <Route path="/marketplace/categories" element={<Navigate to="/marketplace/browse" replace />} />
      <Route
        path="/marketplace/keys"
        element={<AuthAwareRedirect authed="/dashboard/keys" guest="/marketplace/browse" />}
      />
      <Route
        path="/marketplace/usage"
        element={<AuthAwareRedirect authed="/dashboard/usage" guest="/marketplace/browse" />}
      />

      {/* Public aliases — must be registered before the guarded /dashboard tree */}
      <Route path="/dashboard/browse" element={<Navigate to="/marketplace/browse" replace />} />
      <Route path="/dashboard/featured" element={<Navigate to="/marketplace/browse" replace />} />
      <Route path="/dashboard/categories" element={<Navigate to="/marketplace/browse" replace />} />
      <Route path="/dashboard/creators" element={<Navigate to="/marketplace/creators" replace />} />
      <Route path="/dashboard/creators/:walletAddress" element={<RedirectMarketplaceCreator />} />
      <Route path="/dashboard/gateway-marketplace" element={<Navigate to="/marketplace/gateway" replace />} />

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
        <Route path="browse" element={<Navigate to="/marketplace/browse" replace />} />
        <Route path="featured" element={<Navigate to="/marketplace/browse" replace />} />
        <Route path="categories" element={<Navigate to="/marketplace/browse" replace />} />
        <Route path="keys" element={<UserDashboard />} />
        <Route path="usage" element={<PredictionDashboard />} />
        <Route path="gateway" element={<GatewayWallet />} />
        <Route path="gateway-marketplace" element={<Navigate to="/marketplace/gateway" replace />} />
        <Route path="contract" element={<OnChainContract />} />
        <Route path="creators" element={<Navigate to="/marketplace/creators" replace />} />
        <Route path="creators/:walletAddress" element={<RedirectMarketplaceCreator />} />
        <Route path="services/:id" element={<RedirectUserService />} />
      </Route>

      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<Navigate to="how-it-works" replace />} />
        <Route path="home" element={<Navigate to="how-it-works" replace />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="x402" element={<X402Docs />} />
        <Route path="x402-api" element={<X402DevDocs />} />
        <Route path="playground" element={<X402Playground />} />
        <Route path="withdrawal" element={<WithdrawalDocs />} />
        <Route path="cli" element={<CliDocs />} />
        <Route path="migration" element={<MigrationDocs />} />
        <Route path="faq" element={<FaqDocs />} />
        <Route path="pricing" element={<PricingDocs />} />
      </Route>

      <Route path="/user/services/:id" element={<RedirectUserService />} />

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

      <Route path="/studio" element={<StudioLayout />}>
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
        <Route
          path="blogging-agent"
          element={
            <StudioSuspense>
              <BloggingAgent />
            </StudioSuspense>
          }
        />
        <Route
          path="clipcraft"
          element={
            <StudioSuspense>
              <ClipCraft />
            </StudioSuspense>
          }
        />
        <Route
          path="prompt-generator"
          element={
            <StudioSuspense>
              <PromptGenerator />
            </StudioSuspense>
          }
        />
        <Route
          path="viral-thumbnail"
          element={
            <StudioSuspense>
              <ViralThumbnailAI />
            </StudioSuspense>
          }
        />
        <Route
          path="creative-workflow"
          element={
            <StudioSuspense>
              <CreativeWorkflow />
            </StudioSuspense>
          }
        />
        <Route
          path="agentic-pipeline"
          element={
            <StudioSuspense>
              <AgenticPipeline />
            </StudioSuspense>
          }
        />
        <Route path="projects" element={<StudioProjects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="calendar" element={<StudioCalendar />} />
        <Route path="drafts" element={<StudioDrafts />} />
        <Route path="published" element={<StudioPublished />} />
        <Route path="platforms" element={<StudioPlatforms />} />
        <Route
          path="analytics"
          element={
            <StudioSuspense>
              <StudioAnalytics />
            </StudioSuspense>
          }
        />
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
        <Route
          path="chat"
          element={
            <StudioSuspense>
              <StudioChat />
            </StudioSuspense>
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
        path="/creator/gateway"
        element={
          <Guard role="creator">
            <GatewayDeveloper />
          </Guard>
        }
      />
      <Route
        path="/creator/gateway-admin"
        element={
          <Guard role="creator">
            <GatewayAdmin />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
