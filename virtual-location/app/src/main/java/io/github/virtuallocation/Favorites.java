package io.github.virtuallocation;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Saved places, stored in WGS-84 as a JSON array in SharedPreferences. */
public final class Favorites {
    public static final class Place {
        public final String name;
        public final double lat;
        public final double lng;

        Place(String name, double lat, double lng) {
            this.name = name;
            this.lat = lat;
            this.lng = lng;
        }
    }

    private static final String KEY = "favorites";
    private final SharedPreferences prefs;

    public Favorites(Context context) {
        prefs = context.getSharedPreferences("favorites", Context.MODE_PRIVATE);
    }

    public List<Place> list() {
        List<Place> places = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs.getString(KEY, "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject o = array.getJSONObject(i);
                places.add(new Place(o.getString("name"), o.getDouble("lat"), o.getDouble("lng")));
            }
        } catch (JSONException e) {
            // Corrupt data: start over rather than crash.
        }
        return places;
    }

    public void add(String name, double lat, double lng) {
        List<Place> places = list();
        places.add(new Place(name, lat, lng));
        save(places);
    }

    public void remove(int index) {
        List<Place> places = list();
        if (index >= 0 && index < places.size()) {
            places.remove(index);
            save(places);
        }
    }

    private void save(List<Place> places) {
        JSONArray array = new JSONArray();
        try {
            for (Place p : places) {
                array.put(new JSONObject().put("name", p.name).put("lat", p.lat).put("lng", p.lng));
            }
        } catch (JSONException e) {
            return;
        }
        prefs.edit().putString(KEY, array.toString()).apply();
    }
}
