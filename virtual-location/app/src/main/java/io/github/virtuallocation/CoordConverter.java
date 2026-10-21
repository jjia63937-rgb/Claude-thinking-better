package io.github.virtuallocation;

/**
 * Converts between WGS-84 (what GPS and the mock location API use), GCJ-02
 * (Amap, Tencent, Google in mainland China) and BD-09 (Baidu).
 *
 * Coordinates copied from a Chinese map app are offset from WGS-84 by up to
 * several hundred meters, so they must be converted before being mocked.
 */
public final class CoordConverter {
    public static final int WGS84 = 0;
    public static final int GCJ02 = 1;
    public static final int BD09 = 2;

    private static final double A = 6378245.0;
    private static final double EE = 0.00669342162296594323;
    private static final double X_PI = Math.PI * 3000.0 / 180.0;

    private CoordConverter() {}

    /** Returns {lat, lng} in WGS-84. */
    public static double[] toWgs84(int system, double lat, double lng) {
        switch (system) {
            case GCJ02:
                return gcj02ToWgs84(lat, lng);
            case BD09: {
                double[] gcj = bd09ToGcj02(lat, lng);
                return gcj02ToWgs84(gcj[0], gcj[1]);
            }
            default:
                return new double[] {lat, lng};
        }
    }

    /** Returns {lat, lng} in the given system. */
    public static double[] fromWgs84(int system, double lat, double lng) {
        switch (system) {
            case GCJ02:
                return wgs84ToGcj02(lat, lng);
            case BD09: {
                double[] gcj = wgs84ToGcj02(lat, lng);
                return gcj02ToBd09(gcj[0], gcj[1]);
            }
            default:
                return new double[] {lat, lng};
        }
    }

    public static double[] wgs84ToGcj02(double lat, double lng) {
        if (outOfChina(lat, lng)) {
            return new double[] {lat, lng};
        }
        double[] d = delta(lat, lng);
        return new double[] {lat + d[0], lng + d[1]};
    }

    /** Inverts {@link #wgs84ToGcj02} by iteration; accurate to well under a meter. */
    public static double[] gcj02ToWgs84(double lat, double lng) {
        if (outOfChina(lat, lng)) {
            return new double[] {lat, lng};
        }
        double wLat = lat;
        double wLng = lng;
        for (int i = 0; i < 10; i++) {
            double[] g = wgs84ToGcj02(wLat, wLng);
            double dLat = g[0] - lat;
            double dLng = g[1] - lng;
            wLat -= dLat;
            wLng -= dLng;
            if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) {
                break;
            }
        }
        return new double[] {wLat, wLng};
    }

    public static double[] gcj02ToBd09(double lat, double lng) {
        double z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
        double theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
        return new double[] {z * Math.sin(theta) + 0.006, z * Math.cos(theta) + 0.0065};
    }

    public static double[] bd09ToGcj02(double lat, double lng) {
        double x = lng - 0.0065;
        double y = lat - 0.006;
        double z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
        double theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
        return new double[] {z * Math.sin(theta), z * Math.cos(theta)};
    }

    private static boolean outOfChina(double lat, double lng) {
        return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    }

    private static double[] delta(double lat, double lng) {
        double dLat = transformLat(lng - 105.0, lat - 35.0);
        double dLng = transformLng(lng - 105.0, lat - 35.0);
        double radLat = lat / 180.0 * Math.PI;
        double magic = Math.sin(radLat);
        magic = 1 - EE * magic * magic;
        double sqrtMagic = Math.sqrt(magic);
        dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * Math.PI);
        dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * Math.PI);
        return new double[] {dLat, dLng};
    }

    private static double transformLat(double x, double y) {
        double ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y
                + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
        return ret;
    }

    private static double transformLng(double x, double y) {
        double ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y
                + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
        return ret;
    }
}
