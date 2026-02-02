import { Outlet } from "react-router-dom";
import BottomNav from "../components/BottomNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main content – push up so fixed nav doesn't overlap */}
      <main className="flex-1 pb-20 md:pb-24 overflow-y-auto">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
};

export default AppLayout;