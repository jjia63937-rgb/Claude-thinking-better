package io.github.virtuallocation;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.osmdroid.config.Configuration;
import org.osmdroid.config.IConfigurationProvider;
import org.osmdroid.events.MapEventsReceiver;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.MapEventsOverlay;
import org.osmdroid.views.overlay.Marker;
import org.osmdroid.views.overlay.Polyline;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity implements MockLocationService.Listener {
    private static final int REQUEST_PERMISSIONS = 1;
    // Tiananmen Square, used until the user picks a place.
    private static final double DEFAULT_LAT = 39.908692;
    private static final double DEFAULT_LNG = 116.397477;

    private MapView map;
    private Marker targetMarker;
    private Marker currentMarker;
    private Polyline routeLine;
    private RadioGroup modeGroup;
    private Spinner coordSpinner;
    private EditText latInput;
    private EditText lngInput;
    private EditText speedInput;
    private CheckBox loopCheck;
    private View routeOptions;
    private TextView statusText;

    private SharedPreferences prefs;
    private Favorites favorites;
    /** Point-mode target, always WGS-84. */
    private GeoPoint target;
    /** Route-mode waypoints, always WGS-84. */
    private final List<GeoPoint> routePoints = new ArrayList<>();
    private AlertDialog mockAppDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        IConfigurationProvider osm = Configuration.getInstance();
        osm.load(this, getSharedPreferences("osmdroid", MODE_PRIVATE));
        osm.setUserAgentValue(getPackageName());
        File cache = new File(getCacheDir(), "osmdroid");
        osm.setOsmdroidBasePath(cache);
        osm.setOsmdroidTileCache(new File(cache, "tiles"));

        setContentView(R.layout.activity_main);
        prefs = getSharedPreferences("state", MODE_PRIVATE);
        favorites = new Favorites(this);

        map = findViewById(R.id.map);
        modeGroup = findViewById(R.id.mode_group);
        coordSpinner = findViewById(R.id.coord_system);
        latInput = findViewById(R.id.lat_input);
        lngInput = findViewById(R.id.lng_input);
        speedInput = findViewById(R.id.speed_input);
        loopCheck = findViewById(R.id.loop_check);
        routeOptions = findViewById(R.id.route_options);
        statusText = findViewById(R.id.status_text);

        setUpMap();

        coordSpinner.setSelection(prefs.getInt("coord_system", CoordConverter.WGS84));
        coordSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                prefs.edit().putInt("coord_system", position).apply();
                showTargetInInputs();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {
            }
        });
        modeGroup.setOnCheckedChangeListener((group, checkedId) -> updateModeUi());

        ((Button) findViewById(R.id.go_button)).setOnClickListener(v -> goToInput());
        ((Button) findViewById(R.id.clear_button)).setOnClickListener(v -> clearRoute());
        ((Button) findViewById(R.id.start_button)).setOnClickListener(v -> startMocking());
        ((Button) findViewById(R.id.stop_button)).setOnClickListener(v -> stopMocking());
        ((Button) findViewById(R.id.save_button)).setOnClickListener(v -> saveFavorite());
        ((Button) findViewById(R.id.favorites_button)).setOnClickListener(v -> showFavorites());

        if (prefs.contains("target_lat")) {
            setTarget(new GeoPoint(Double.longBitsToDouble(prefs.getLong("target_lat", 0)),
                    Double.longBitsToDouble(prefs.getLong("target_lng", 0))), false);
        }
        updateModeUi();
        requestPermissionsIfNeeded();
    }

    @Override
    protected void onResume() {
        super.onResume();
        map.onResume();
        MockLocationService.setListener(this);
    }

    @Override
    protected void onPause() {
        MockLocationService.setListener(null);
        map.onPause();
        super.onPause();
    }

    private void setUpMap() {
        map.setTileSource(TileSourceFactory.MAPNIK);
        map.setMultiTouchControls(true);
        map.setTilesScaledToDpi(true);
        map.getController().setZoom(16.0);
        map.getController().setCenter(new GeoPoint(DEFAULT_LAT, DEFAULT_LNG));

        routeLine = new Polyline(map);
        routeLine.getOutlinePaint().setColor(Color.parseColor("#E8453C"));
        routeLine.getOutlinePaint().setStrokeWidth(10f);
        map.getOverlays().add(routeLine);

        targetMarker = new Marker(map);
        targetMarker.setTitle("目标位置");
        targetMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        targetMarker.setDraggable(true);
        targetMarker.setOnMarkerDragListener(new Marker.OnMarkerDragListener() {
            @Override
            public void onMarkerDrag(Marker marker) {
            }

            @Override
            public void onMarkerDragEnd(Marker marker) {
                setTarget(marker.getPosition(), false);
            }

            @Override
            public void onMarkerDragStart(Marker marker) {
            }
        });

        currentMarker = new Marker(map);
        currentMarker.setTitle("当前模拟位置");
        currentMarker.setIcon(getDrawable(R.drawable.ic_current));
        currentMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER);

        map.getOverlays().add(0, new MapEventsOverlay(new MapEventsReceiver() {
            @Override
            public boolean singleTapConfirmedHelper(GeoPoint p) {
                onMapTap(p);
                return true;
            }

            @Override
            public boolean longPressHelper(GeoPoint p) {
                return false;
            }
        }));
    }

    private boolean isRouteMode() {
        return modeGroup.getCheckedRadioButtonId() == R.id.mode_route;
    }

    private void updateModeUi() {
        boolean route = isRouteMode();
        routeOptions.setVisibility(route ? View.VISIBLE : View.GONE);
        if (route) {
            map.getOverlays().remove(targetMarker);
            setStatus(routePoints.isEmpty()
                    ? "依次点地图添加途经点（至少 2 个）"
                    : "已添加 " + routePoints.size() + " 个途经点");
        } else if (target != null && !map.getOverlays().contains(targetMarker)) {
            map.getOverlays().add(targetMarker);
        }
        refreshRouteLine();
        map.invalidate();
    }

    private void onMapTap(GeoPoint p) {
        if (isRouteMode()) {
            addWaypoint(p);
        } else {
            setTarget(p, false);
        }
    }

    private void setTarget(GeoPoint p, boolean center) {
        target = new GeoPoint(p.getLatitude(), p.getLongitude());
        targetMarker.setPosition(target);
        if (!isRouteMode() && !map.getOverlays().contains(targetMarker)) {
            map.getOverlays().add(targetMarker);
        }
        if (center) {
            map.getController().animateTo(target);
        }
        prefs.edit()
                .putLong("target_lat", Double.doubleToRawLongBits(target.getLatitude()))
                .putLong("target_lng", Double.doubleToRawLongBits(target.getLongitude()))
                .apply();
        showTargetInInputs();
        if (!isRouteMode()) {
            setStatus("已选择目标，点「开始模拟」");
        }
        map.invalidate();
    }

    /** Shows the target in the inputs, in whichever coordinate system is selected. */
    private void showTargetInInputs() {
        if (target == null) {
            return;
        }
        double[] c = CoordConverter.fromWgs84(coordSpinner.getSelectedItemPosition(),
                target.getLatitude(), target.getLongitude());
        latInput.setText(String.format(Locale.US, "%.6f", c[0]));
        lngInput.setText(String.format(Locale.US, "%.6f", c[1]));
    }

    private void addWaypoint(GeoPoint p) {
        routePoints.add(new GeoPoint(p.getLatitude(), p.getLongitude()));
        refreshRouteLine();
        setStatus("已添加 " + routePoints.size() + " 个途经点，全长 "
                + Math.round(routeLength()) + " 米");
    }

    private void clearRoute() {
        routePoints.clear();
        refreshRouteLine();
        setStatus("路线已清除");
    }

    private void refreshRouteLine() {
        routeLine.setPoints(isRouteMode() ? new ArrayList<>(routePoints) : new ArrayList<>());
        map.invalidate();
    }

    private double routeLength() {
        double total = 0;
        for (int i = 1; i < routePoints.size(); i++) {
            GeoPoint a = routePoints.get(i - 1);
            GeoPoint b = routePoints.get(i);
            total += Route.distance(a.getLatitude(), a.getLongitude(), b.getLatitude(), b.getLongitude());
        }
        return total;
    }

    /** Parses the inputs (in the selected system) to WGS-84, or returns null with a toast. */
    private GeoPoint parseInput() {
        String latText = latInput.getText().toString().trim();
        String lngText = lngInput.getText().toString().trim();
        // Accept "lat,lng" pasted into the first field. Amap/Baidu pickers give "lng,lat",
        // so swap when the first number can only be a longitude.
        String[] parts = latText.split("[,，\\s]+");
        if (parts.length == 2) {
            latText = parts[0];
            lngText = parts[1];
        }
        double a;
        double b;
        try {
            a = Double.parseDouble(latText);
            b = Double.parseDouble(lngText);
        } catch (NumberFormatException e) {
            toast("请输入有效的经纬度");
            return null;
        }
        if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
            double t = a;
            a = b;
            b = t;
        }
        if (Math.abs(a) > 90 || Math.abs(b) > 180) {
            toast("经纬度超出范围");
            return null;
        }
        double[] w = CoordConverter.toWgs84(coordSpinner.getSelectedItemPosition(), a, b);
        return new GeoPoint(w[0], w[1]);
    }

    private void goToInput() {
        GeoPoint p = parseInput();
        if (p == null) {
            return;
        }
        if (isRouteMode()) {
            addWaypoint(p);
            map.getController().animateTo(p);
        } else {
            setTarget(p, true);
        }
    }

    private void startMocking() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            toast("需要定位权限才能启动");
            requestPermissionsIfNeeded();
            return;
        }
        Intent intent = new Intent(this, MockLocationService.class)
                .setAction(MockLocationService.ACTION_START);
        if (isRouteMode()) {
            if (routePoints.size() < 2) {
                toast("路线至少需要 2 个途经点");
                return;
            }
            double speed;
            try {
                speed = Double.parseDouble(speedInput.getText().toString().trim());
            } catch (NumberFormatException e) {
                speed = -1;
            }
            if (speed <= 0 || speed > 1000) {
                toast("请输入 0–1000 之间的速度（km/h）");
                return;
            }
            double[] lats = new double[routePoints.size()];
            double[] lngs = new double[routePoints.size()];
            for (int i = 0; i < routePoints.size(); i++) {
                lats[i] = routePoints.get(i).getLatitude();
                lngs[i] = routePoints.get(i).getLongitude();
            }
            intent.putExtra(MockLocationService.EXTRA_LATS, lats)
                    .putExtra(MockLocationService.EXTRA_LNGS, lngs)
                    .putExtra(MockLocationService.EXTRA_SPEED_KMH, speed)
                    .putExtra(MockLocationService.EXTRA_LOOP, loopCheck.isChecked());
        } else {
            if (target == null) {
                toast("请先在地图上点选目标位置");
                return;
            }
            intent.putExtra(MockLocationService.EXTRA_LATS, new double[] {target.getLatitude()})
                    .putExtra(MockLocationService.EXTRA_LNGS, new double[] {target.getLongitude()});
        }
        startForegroundService(intent);
    }

    private void stopMocking() {
        stopService(new Intent(this, MockLocationService.class));
    }

    private void saveFavorite() {
        if (target == null) {
            toast("请先选择一个目标位置");
            return;
        }
        GeoPoint p = target;
        EditText name = new EditText(this);
        name.setHint("名称，例如：公司");
        new AlertDialog.Builder(this)
                .setTitle("收藏当前目标")
                .setView(name)
                .setPositiveButton("保存", (d, w) -> {
                    String n = name.getText().toString().trim();
                    if (n.isEmpty()) {
                        n = String.format(Locale.US, "%.5f, %.5f", p.getLatitude(), p.getLongitude());
                    }
                    favorites.add(n, p.getLatitude(), p.getLongitude());
                    toast("已收藏");
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void showFavorites() {
        List<Favorites.Place> places = favorites.list();
        if (places.isEmpty()) {
            toast("收藏夹是空的");
            return;
        }
        String[] names = new String[places.size()];
        for (int i = 0; i < places.size(); i++) {
            names[i] = places.get(i).name;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.favorites)
                .setItems(names, (d, which) -> showFavoriteActions(places.get(which), which))
                .show();
    }

    private void showFavoriteActions(Favorites.Place place, int index) {
        new AlertDialog.Builder(this)
                .setTitle(place.name)
                .setItems(new String[] {"设为目标", "删除"}, (d, which) -> {
                    if (which == 0) {
                        modeGroup.check(R.id.mode_point);
                        setTarget(new GeoPoint(place.lat, place.lng), true);
                    } else {
                        favorites.remove(index);
                        toast("已删除");
                    }
                })
                .show();
    }

    private void requestPermissionsIfNeeded() {
        List<String> missing = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.ACCESS_FINE_LOCATION);
            missing.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!missing.isEmpty()) {
            requestPermissions(missing.toArray(new String[0]), REQUEST_PERMISSIONS);
        }
    }

    @Override
    public void onMockState(boolean running, double lat, double lng, String status) {
        if (running) {
            currentMarker.setPosition(new GeoPoint(lat, lng));
            if (!map.getOverlays().contains(currentMarker)) {
                map.getOverlays().add(currentMarker);
            }
        } else {
            map.getOverlays().remove(currentMarker);
        }
        if (running) {
            setStatus(String.format(Locale.US, "%s\n%.6f, %.6f（WGS-84）", status, lat, lng));
        } else if (!status.isEmpty()) {
            setStatus(status);
        }
        map.invalidate();
    }

    @Override
    public void onMockError(String message, boolean needsMockAppSetting) {
        setStatus(message);
        if (!needsMockAppSetting) {
            toast(message);
            return;
        }
        if (mockAppDialog != null && mockAppDialog.isShowing()) {
            return;
        }
        mockAppDialog = new AlertDialog.Builder(this)
                .setTitle(R.string.need_mock_title)
                .setMessage(R.string.need_mock_message)
                .setPositiveButton(R.string.open_developer_options, (d, w) -> openDeveloperOptions())
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void openDeveloperOptions() {
        try {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS));
        } catch (ActivityNotFoundException e) {
            // Developer options not enabled yet: send the user to "About phone".
            startActivity(new Intent(Settings.ACTION_DEVICE_INFO_SETTINGS));
        }
    }

    private void setStatus(String text) {
        statusText.setText(text);
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
    }
}
