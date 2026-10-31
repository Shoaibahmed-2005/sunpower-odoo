import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DeliveredProduct, portalService } from "../../portal/api";
import { ShieldCheck, ShieldAlert, Wrench, Calendar, CheckCircle } from "lucide-react";

export default function CustomerProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<DeliveredProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalService
      .getProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => console.error("Failed to load products", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Solar Equipment</h1>
          <p className="text-sm text-slate-500">
            All solar components delivered and installed at your premises with live warranty status.
          </p>
        </div>
        <Link
          to="/portal/requests"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Wrench className="w-4 h-4" /> Raise Service Ticket
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No equipment installed yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Once your solar system order is validated and dispatched, your equipment serials and warranty cards will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {products.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {item.productName}
                  </h3>
                  {item.underWarranty ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" /> Covered
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                      <ShieldAlert className="w-3.5 h-3.5" /> Expired
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Serial Number:</span>
                    <span className="font-mono font-bold text-slate-800">{item.serial}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Installation Ref:</span>
                    <span className="font-mono text-slate-700">{item.leadRef}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Delivered Date:</span>
                    <span>{item.deliveredAt ? new Date(item.deliveredAt).toLocaleDateString() : "—"}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Warranty Valid Until:</span>
                    <span className={`font-semibold ${item.underWarranty ? "text-emerald-700" : "text-rose-700"}`}>
                      {item.warrantyUntil || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/portal/requests?serial=${encodeURIComponent(item.serial)}`)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5" /> Request Service for this unit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

