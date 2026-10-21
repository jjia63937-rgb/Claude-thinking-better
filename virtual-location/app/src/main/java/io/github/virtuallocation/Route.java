package io.github.virtuallocation;

/** A polyline of WGS-84 points that can be sampled by distance traveled. */
public final class Route {
    private static final double EARTH_RADIUS_M = 6371008.8;

    private final double[] lats;
    private final double[] lngs;
    /** cumulative[i] = distance in meters from the first point to point i. */
    private final double[] cumulative;

    /** If {@code loop} is set and the route isn't already closed, it returns to the first point. */
    public Route(double[] lats, double[] lngs, boolean loop) {
        int n = lats.length;
        boolean close = loop && n > 1
                && (lats[0] != lats[n - 1] || lngs[0] != lngs[n - 1]);
        int size = close ? n + 1 : n;
        this.lats = new double[size];
        this.lngs = new double[size];
        System.arraycopy(lats, 0, this.lats, 0, n);
        System.arraycopy(lngs, 0, this.lngs, 0, n);
        if (close) {
            this.lats[n] = lats[0];
            this.lngs[n] = lngs[0];
        }
        cumulative = new double[size];
        for (int i = 1; i < size; i++) {
            cumulative[i] = cumulative[i - 1]
                    + distance(this.lats[i - 1], this.lngs[i - 1], this.lats[i], this.lngs[i]);
        }
    }

    public double length() {
        return cumulative[cumulative.length - 1];
    }

    public boolean isSinglePoint() {
        return lats.length == 1 || length() == 0;
    }

    /** Returns {lat, lng, bearingDegrees} at {@code meters} along the route, clamped to its ends. */
    public double[] sample(double meters) {
        int last = lats.length - 1;
        if (last == 0 || meters <= 0) {
            return new double[] {lats[0], lngs[0], last == 0 ? 0 : bearing(0)};
        }
        if (meters >= length()) {
            return new double[] {lats[last], lngs[last], bearing(last - 1)};
        }
        int i = 0;
        while (i < last - 1 && cumulative[i + 1] < meters) {
            i++;
        }
        double segment = cumulative[i + 1] - cumulative[i];
        double f = segment == 0 ? 0 : (meters - cumulative[i]) / segment;
        return new double[] {
                lats[i] + f * (lats[i + 1] - lats[i]),
                lngs[i] + f * (lngs[i + 1] - lngs[i]),
                bearing(i)
        };
    }

    private double bearing(int segment) {
        double phi1 = Math.toRadians(lats[segment]);
        double phi2 = Math.toRadians(lats[segment + 1]);
        double dLambda = Math.toRadians(lngs[segment + 1] - lngs[segment]);
        double y = Math.sin(dLambda) * Math.cos(phi2);
        double x = Math.cos(phi1) * Math.sin(phi2)
                - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        return (Math.toDegrees(Math.atan2(y, x)) + 360) % 360;
    }

    /** Haversine distance in meters. */
    public static double distance(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
    }
}
