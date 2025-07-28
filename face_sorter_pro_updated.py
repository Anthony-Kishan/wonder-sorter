import os
import cv2
import shutil
import numpy as np
import threading
import insightface
from insightface.app import FaceAnalysis
from sklearn.metrics.pairwise import cosine_similarity
import hdbscan
import warnings

warnings.filterwarnings("ignore", category=FutureWarning)

# === CONFIG ===
CACHE_FILE = "wonder_sorter_cache.npz"
IMAGE_EXT = ['.jpg', '.jpeg', '.png']
OUTPUT_FOLDER = "Sorted_Images_Pro"
GROUP_PHOTO_FOLDER = os.path.join(OUTPUT_FOLDER, "Group_Photos")

# === GLOBAL STOP FLAG ===
stop_flag = threading.Event()

# === MODEL INIT ===
face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=1)


def load_cache():
    if os.path.exists(CACHE_FILE):
        data = np.load(CACHE_FILE, allow_pickle=True)
        return dict(data['emb_map'].item()), list(data['ids'])
    return {}, []


def save_cache(emb_map, ids):
    np.savez(CACHE_FILE, emb_map=emb_map, ids=np.array(ids))


def reset_cache():
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
    if os.path.isdir(OUTPUT_FOLDER):
        shutil.rmtree(OUTPUT_FOLDER)
    if os.path.isdir(GROUP_PHOTO_FOLDER):
        shutil.rmtree(GROUP_PHOTO_FOLDER)


def is_image_file(name):
    return any(name.lower().endswith(ext) for ext in IMAGE_EXT)


def match_or_add(emb, emb_map, ids, sim_threshold):
    if ids:
        avgs = np.vstack([np.mean(emb_map[i], axis=0) for i in ids])
        sims = cosine_similarity(emb, avgs)[0]
        i = np.argmax(sims)
        if sims[i] > sim_threshold:
            pid = ids[i]
            emb_map[pid].append(emb.flatten())
            return pid
    pid = f"person_{len(ids)+1}"
    ids.append(pid)
    emb_map[pid] = [emb.flatten()]
    return pid


def recluster(emb_map, ids, min_cluster_size):
    all_embs = []
    keys = []

    for k in ids:
        for e in emb_map[k]:
            all_embs.append(e)
            keys.append(k)

    if not all_embs:
        return

    arr = np.stack(all_embs)
    cluster = hdbscan.HDBSCAN(metric='euclidean', min_cluster_size=min_cluster_size).fit(arr)

    new_emb_map = {}
    new_ids_set = set()

    for key, emb, lbl in zip(keys, all_embs, cluster.labels_):
        if lbl == -1:
            continue  # Ignore noise
        new_key = f"cluster_{lbl+1}"
        new_emb_map.setdefault(new_key, []).append(emb)
        new_ids_set.add(new_key)

    # Update emb_map and ids
    emb_map.clear()
    emb_map.update(new_emb_map)
    ids.clear()
    ids.extend(sorted(new_ids_set))

    # Rename folders on disk
    for old in os.listdir(OUTPUT_FOLDER):
        src = os.path.join(OUTPUT_FOLDER, old)
        if not os.path.isdir(src):
            continue

        new_name = None
        for key in new_emb_map.keys():
            if old in key or old in emb_map:
                new_name = key
                break

        dst = os.path.join(OUTPUT_FOLDER, new_name) if new_name else src
        if src != dst:
            os.makedirs(dst, exist_ok=True)
            for f in os.listdir(src):
                shutil.move(os.path.join(src, f), dst)
            shutil.rmtree(src)


def sort_faces(input_folder, log_fn, progress_fn, stop_flag=None, sim_threshold=0.62, resize_scale=0.5, min_cluster_size=2):
    emb_map, ids = load_cache()
    files = [os.path.join(dp, f)
             for dp, _, fs in os.walk(input_folder)
             for f in fs if is_image_file(f)]
    total_files = len(files)

    for i, path in enumerate(files, 1):
        if stop_flag and stop_flag.is_set():
            log_fn(None, "cancelled", None)
            return

        img = cv2.imread(path)
        filename = os.path.basename(path)

        if img is None:
            log_fn(filename, "read_error", None)
            progress_fn(int(i / total_files * 100))
            continue

        small = cv2.resize(img, (0, 0), fx=resize_scale, fy=resize_scale)
        faces = face_app.get(small)

        if not faces:
            log_fn(filename, "no_face", None)
            progress_fn(int(i / total_files * 100))
            continue

        if len(faces) > 1:
            os.makedirs(GROUP_PHOTO_FOLDER, exist_ok=True)
            shutil.copy(path, os.path.join(GROUP_PHOTO_FOLDER, filename))
            log_fn(filename, "group_photo", None)
            progress_fn(int(i / total_files * 100))
            continue

        emb = faces[0].normed_embedding.reshape(1, -1)
        pid = match_or_add(emb, emb_map, ids, sim_threshold)

        dest = os.path.join(OUTPUT_FOLDER, pid)
        os.makedirs(dest, exist_ok=True)
        shutil.copy(path, os.path.join(dest, filename))
        log_fn(filename, "success", pid)
        progress_fn(int(i / total_files * 100))

    recluster(emb_map, ids, min_cluster_size)
    save_cache(emb_map, ids)
    log_fn(None, "done", None)
