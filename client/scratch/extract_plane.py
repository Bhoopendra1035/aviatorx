import sys
from PIL import Image, ImageChops

def main():
    original_path = r"C:\Users\HP\.gemini\antigravity\brain\5a712629-9f48-4450-8d90-599c92159b8d\media__1778578219702.png"
    output_path = r"e:\aviator system\client\public\plane.png"
    
    # Load image
    img = Image.open(original_path).convert("RGBA")
    w, h = img.size
    
    # Crop the top half where the plane is (y: 0 to 280)
    plane_crop = img.crop((0, 0, w, 290))
    
    # Make white background transparent
    # Any pixel where R > 240, G > 240, B > 240 will become transparent
    datas = plane_crop.getdata()
    new_data = []
    for item in datas:
        r, g, b, a = item
        # If it's near white, make it fully transparent
        if r > 230 and g > 230 and b > 230:
            new_data.append((255, 255, 255, 0))
        else:
            # Keep original pixel, but let's make the red even more vibrant
            # If the pixel is reddish (r > 150, g < 100, b < 100), we can keep it
            new_data.append((r, g, b, a))
            
    plane_crop.putdata(new_data)
    
    # Auto-bbox crop to remove transparent padding
    # Bounding box of non-zero alpha
    bbox = plane_crop.getbbox()
    if bbox:
        plane_final = plane_crop.crop(bbox)
    else:
        plane_final = plane_crop
        
    # Save the file
    plane_final.save(output_path, "PNG")
    print("Plane image successfully extracted and saved to public/plane.png!", plane_final.size)

if __name__ == "__main__":
    main()
