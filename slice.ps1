Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class Slicer {
    public static void Slice(string path, string outDir) {
        Bitmap img = new Bitmap(path);
        bool[,] visited = new bool[img.Width, img.Height];
        int count = 0;
        
        for (int y = 0; y < img.Height; y++) {
            for (int x = 0; x < img.Width; x++) {
                if (!visited[x, y] && img.GetPixel(x, y).A > 0) {
                    List<Point> pts = new List<Point>();
                    Queue<Point> q = new Queue<Point>();
                    q.Enqueue(new Point(x, y));
                    visited[x, y] = true;
                    
                    while(q.Count > 0) {
                        Point p = q.Dequeue();
                        pts.Add(p);
                        
                        Point[] dirs = { new Point(1,0), new Point(-1,0), new Point(0,1), new Point(0,-1), new Point(1,1), new Point(-1,-1), new Point(1,-1), new Point(-1,1) };
                        foreach(Point d in dirs) {
                            int nx = p.X + d.X, ny = p.Y + d.Y;
                            if (nx >= 0 && nx < img.Width && ny >= 0 && ny < img.Height && !visited[nx, ny] && img.GetPixel(nx, ny).A > 0) {
                                visited[nx, ny] = true;
                                q.Enqueue(new Point(nx, ny));
                            }
                        }
                    }
                    
                    if (pts.Count > 30) {
                        Bitmap layer = new Bitmap(img.Width, img.Height);
                        foreach(Point pt in pts) {
                            layer.SetPixel(pt.X, pt.Y, img.GetPixel(pt.X, pt.Y));
                        }
                        layer.Save(outDir + "\\part_" + count + ".png", ImageFormat.Png);
                        Console.WriteLine("Saved part " + count + " with " + pts.Count + " pixels.");
                        count++;
                    }
                }
            }
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies "System.Drawing"
[Slicer]::Slice("d:\xampp\htdocs\img\logo.png", "d:\xampp\htdocs\img")
