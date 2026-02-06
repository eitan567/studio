import json
import os
import re

SVG_DIR = r"c:\Users\Eitan Baron\Documents\GitHub\studio\src\canva-templates"
OUTPUT_FILE = r"c:\Users\Eitan Baron\Documents\GitHub\studio\src\lib\canva-templates-data.ts"

def get_path_tokens(path_d):
    """
    Tokenizes SVG path data into commands and numbers.
    """
    token_re = re.compile(r"([a-df-z]|[A-DF-Z]|-?\d*\.?\d+)")
    return token_re.findall(path_d)

def get_path_bounds(path_d):
    """
    Accurately calculates the bounding box of an SVG path.
    Handles M, L, H, V, C, S, Q, T, A, Z (including relative commands).
    """
    tokens = get_path_tokens(path_d)
    if not tokens:
        return 0, 0, 100, 100
    
    xs, ys = [], []
    curr_x, curr_y = 0, 0
    last_cmd = ''
    i = 0
    
    while i < len(tokens):
        token = tokens[i]
        if token.isalpha():
            cmd = token
            i += 1
        else:
            cmd = last_cmd
            # If no command yet, it's malformed but let's assume M
            if not cmd: cmd = 'M'
            
        # Command map: (num_coords, is_relative)
        # We only really care about updating curr_x, curr_y to track max/min
        
        upper_cmd = cmd.upper()
        is_rel = cmd.islower()
        
        try:
            if upper_cmd in ('M', 'L', 'T'):
                vx = float(tokens[i])
                vy = float(tokens[i+1])
                curr_x = vx + (curr_x if is_rel else 0)
                curr_y = vy + (curr_y if is_rel else 0)
                xs.append(curr_x); ys.append(curr_y)
                i += 2
            elif upper_cmd == 'H':
                vx = float(tokens[i])
                curr_x = vx + (curr_x if is_rel else 0)
                xs.append(curr_x)
                i += 1
            elif upper_cmd == 'V':
                vy = float(tokens[i])
                curr_y = vy + (curr_y if is_rel else 0)
                ys.append(curr_y)
                i += 1
            elif upper_cmd in ('S', 'Q'):
                # x1, y1 (ignored for bounds if we just want points, 
                # but technically curves should be accounted for. 
                # For simplified frames, start/end points are usually enough).
                vx1 = float(tokens[i]); vy1 = float(tokens[i+1])
                vx = float(tokens[i+2]); vy = float(tokens[i+3])
                # We could add vx1/vy1 to xs/ys for safety
                xs.append(vx1 + (curr_x if is_rel else 0))
                ys.append(vy1 + (curr_y if is_rel else 0))
                curr_x = vx + (curr_x if is_rel else 0)
                curr_y = vy + (curr_y if is_rel else 0)
                xs.append(curr_x); ys.append(curr_y)
                i += 4
            elif upper_cmd == 'C':
                vx1 = float(tokens[i]); vy1 = float(tokens[i+1])
                vx2 = float(tokens[i+2]); vy2 = float(tokens[i+3])
                vx = float(tokens[i+4]); vy = float(tokens[i+5])
                xs.append(vx1 + (curr_x if is_rel else 0))
                ys.append(vy1 + (curr_y if is_rel else 0))
                xs.append(vx2 + (curr_x if is_rel else 0))
                ys.append(vy2 + (curr_y if is_rel else 0))
                curr_x = vx + (curr_x if is_rel else 0)
                curr_y = vy + (curr_y if is_rel else 0)
                xs.append(curr_x); ys.append(curr_y)
                i += 6
            elif upper_cmd == 'A':
                # rx, ry, rot, large, sweep, x, y
                vx = float(tokens[i+5]); vy = float(tokens[i+6])
                curr_x = vx + (curr_x if is_rel else 0)
                curr_y = vy + (curr_y if is_rel else 0)
                xs.append(curr_x); ys.append(curr_y)
                i += 7
            elif upper_cmd == 'Z':
                # Close path, doesn't change curr_x/y
                i += 0 
            else:
                # Unknown command, skip
                i += 1
        except (ValueError, IndexError):
            break
            
        last_cmd = cmd

    if not xs or not ys:
        return 0, 0, 100, 100
        
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    return min_x, min_y, max_x, max_y

def process_frames_json():
    json_path = os.path.join(SVG_DIR, "frames.json")
    if not os.path.exists(json_path):
        return None
        
    with open(json_path, "r") as f:
        data = json.load(f)
    
    regions = []
    for i, item in enumerate(data):
        raw_path = item["pathD"]
        vb = item["viewBox"].split()
        vw = float(vb[2])
        vh = float(vb[3])
        
        # 1. Get accurate bounds
        min_x, min_y, max_x, max_y = get_path_bounds(raw_path)
        
        # 2. Convert raw bounds to percentages relative to design page
        perc_x = (min_x / vw) * 100
        perc_y = (min_y / vh) * 100
        perc_w = ((max_x - min_x) / vw) * 100
        perc_h = ((max_y - min_y) / vh) * 100
        
        regions.append({
            "id": f"canva-grid-{i}",
            "shape": "path",
            "path": raw_path, # KEEP RAW PATH
            "viewBox": f"{min_x} {min_y} {max_x - min_x} {max_y - min_y}",
            "bounds": {
                "x": round(perc_x, 3), 
                "y": round(perc_y, 3), 
                "width": round(perc_w, 3), 
                "height": round(perc_h, 3)
            },
            "zIndex": 1
        })
    
    return {
        "id": "canva-mosaic-grid",
        "name": "Canva Mosaic Grid",
        "category": "grid",
        "photoCount": len(regions),
        "createdBy": "system",
        "regions": regions
    }

def process_artboards():
    templates = []
    if not os.path.exists(SVG_DIR):
        return templates
        
    files = [f for f in os.listdir(SVG_DIR) if (f.startswith("Artboard") or re.match(r"^\d+\.svg$", f)) and f.endswith(".svg")]
    files.sort()

    for filename in files:
        file_path = os.path.join(SVG_DIR, filename)
        with open(file_path, "r", encoding='utf-8') as f:
            content = f.read()
            
        path_match = re.search(r'\bd="([^"]+)"', content)
        if not path_match: continue
        
        raw_path = path_match.group(1)
        
        vb_match = re.search(r'viewBox="0 0 (\d+) (\d+)"', content)
        if vb_match:
            vw = float(vb_match.group(1))
            vh = float(vb_match.group(2))
        else:
            vw, vh = 2000, 2000
            
        min_x, min_y, max_x, max_y = get_path_bounds(raw_path)
        
        perc_x = (min_x / vw) * 100
        perc_y = (min_y / vh) * 100
        perc_w = ((max_x - min_x) / vw) * 100
        perc_h = ((max_y - min_y) / vh) * 100
        
        name = filename.split('.')[0]
        templates.append({
            "id": f"canva-{filename.replace(' ', '-').lower()}",
            "name": f"Canva {name}",
            "category": "grid",
            "photoCount": 1,
            "createdBy": "system",
            "regions": [{
                "id": "main",
                "shape": "path",
                "path": raw_path, # KEEP RAW PATH
                "viewBox": f"{min_x} {min_y} {max_x - min_x} {max_y - min_y}",
                "bounds": {
                    "x": round(perc_x, 3), 
                    "y": round(perc_y, 3), 
                    "width": round(perc_w, 3), 
                    "height": round(perc_h, 3)
                },
                "zIndex": 1
            }]
        })
    return templates

def main():
    templates = []
    
    grid = process_frames_json()
    if grid:
        templates.append(grid)
        
    art = process_artboards()
    templates.extend(art)
    
    with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
        f.write("import { AdvancedTemplate } from './advanced-layout-types';\n\n")
        f.write("export const CANVA_TEMPLATES: AdvancedTemplate[] = ")
        f.write(json.dumps(templates, indent=4))
        f.write(" as any;\n")

if __name__ == "__main__":
    main()
