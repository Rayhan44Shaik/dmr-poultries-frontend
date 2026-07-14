import { CalendarDays } from "lucide-react";

function WelcomeCard() {
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hour = today.getHours();

  let greeting = "Good Evening";

  if (hour < 12) {
    greeting = "Good Morning";
  } else if (hour < 17) {
    greeting = "Good Afternoon";
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">

      <h1 className="text-4xl font-bold text-slate-800">
        {greeting}, Ruhulla 👋
      </h1>

      <p className="text-gray-500 mt-2 text-lg">
        Welcome back to DMR Poultries
      </p>

      <div className="flex items-center gap-2 mt-6 text-gray-500">

        <CalendarDays size={18} />

        <span>{formattedDate}</span>

      </div>

    </div>
  );
}

export default WelcomeCard;