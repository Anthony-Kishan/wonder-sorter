import threading
import webview
import os
import json
import webbrowser
from face_sorter_pro_updated import sort_faces, reset_cache, recluster, OUTPUT_FOLDER
from api_utils import load_cache, save_cache

SETTINGS_FILE = 'settings.json'
DEFAULT_SETTINGS = {
    "sim_threshold": 0.62,
    "resize_scale": 0.5,
    "min_cluster_size": 2
}

class API:
    def __init__(self):
        self._stop_flag = threading.Event()
        self._lock = threading.Lock()

    def choose_folder(self):
        return webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG, allow_multiple=False)

    def start_sorting(self, folder, settings=None):    
        if self._stop_flag.is_set():
            self._stop_flag.clear()
        # Default settings if not provided
        threshold = 0.62
        resize_scale = 0.5
        cluster_size = 2

        if settings:
            threshold = float(settings.get("sim_threshold", threshold))       
            resize_scale = float(settings.get("resize_scale", resize_scale))  
            cluster_size = int(settings.get("min_cluster_size", cluster_size))
        
        t = threading.Thread(target=self._run_sort, args=(folder, threshold, resize_scale, cluster_size), daemon=True)
        t.start()
        print("Thread started:", t.is_alive())
        return True

    def _run_sort(self, folder, threshold, resize_scale, cluster_size):
        def log_fn(filename, status, person_id):
            try:
                filename_js = 'null' if filename is None else json.dumps(filename)
                status_js = 'null' if status is None else json.dumps(status)
                person_id_js = 'null' if person_id is None else json.dumps(person_id)
                js_call = f"updateLog({filename_js}, {status_js}, {person_id_js});"
                webview.windows[0].evaluate_js(js_call)
            except Exception as e:
                print(f"Error updating log: {e}")

        def prog_fn(percent):
            try:
                webview.windows[0].evaluate_js(f"updateProgress({percent});")
            except Exception as e:
                print(f"Error updating progress: {e}")

        try:
            sort_faces(folder, log_fn, prog_fn, stop_flag=self._stop_flag,
                       sim_threshold=threshold,
                       resize_scale=resize_scale,
                       min_cluster_size=cluster_size)
        except Exception as e:
            print(f"Error during sorting: {e}")
            log_fn(None, "error", None)
        finally:
            try:
                webview.windows[0].evaluate_js("onFinish();")
            except Exception as e:
                print(f"Error calling onFinish JS: {e}")

    def cancel_sorting(self):
        self._stop_flag.set()

    def clear_cache(self):
        with self._lock:
            reset_cache()
        return True

    def open_output_folder(self):
        if os.path.exists(OUTPUT_FOLDER):
            os.startfile(OUTPUT_FOLDER)
            return True
        else:
            print(f"Output folder does not exist: {OUTPUT_FOLDER}")
            return False

    def rename_cluster(self, old_name, new_name):
        """
        Stub: To rename cluster folders and update cache.
        Needs frontend UI and additional backend logic.
        """
        print(f"Rename cluster requested: {old_name} -> {new_name}")
        # TODO: implement rename logic safely with cache update
        return True

    # Optional: Methods to load/save known faces for tagging (for future use)
    def load_known_faces(self):
        pass

    def save_known_faces(self, known_faces_data):
        pass

    def save_settings(self, settings):
        try:
            # Validate and convert
            sim_threshold = float(settings.get("sim_threshold", 0.62))
            resize_scale = float(settings.get("resize_scale", 0.5))
            min_cluster_size = int(settings.get("min_cluster_size", 2))

            clean_settings = {
                "sim_threshold": sim_threshold,
                "resize_scale": resize_scale,
                "min_cluster_size": min_cluster_size
            }

            with open(SETTINGS_FILE, "w") as f:
                json.dump(clean_settings, f, indent=2)

            return {"success": True, "message": "Settings saved successfully."}
        except Exception as e:
            return {"success": False, "message": f"Error saving settings: {str(e)}"}

    def load_settings(self):
        try:
            if os.path.exists(SETTINGS_FILE):
                with open(SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                    return {"success": True, "settings": data}
            else:
                return {"success": True, "settings": DEFAULT_SETTINGS}
        except Exception as e:
            return {"success": False, "message": f"Error loading settings: {str(e)}"}
        
    def load_view(self, view_name):
        base_path = os.path.abspath(os.path.dirname(__file__))

        if view_name == "main":
            path = os.path.join(base_path, "static", "index.html")
        elif view_name == "settings":
            path = os.path.join(base_path, "static", "settings", "index.html")
        elif view_name == "about":
            path = os.path.join(base_path, "static", "about", "index.html")
        else:
            return {"success": False, "message": f"Unknown view: {view_name}"}

        url = f"file://{path.replace(os.sep, '/')}"
        self._window.load_url(url)
        return {"success": True}

    def open_external(self, url):
        webbrowser.open(url)
        return True